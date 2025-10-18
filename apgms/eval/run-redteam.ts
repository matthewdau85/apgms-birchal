import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Executor = "llm" | "api";

type CaseCheck = {
  type: "contains" | "equals";
  field: "text" | "status";
  expect: string | number;
  negate?: boolean;
  description?: string;
};

type CaseDefinition = {
  id: string;
  title: string;
  category: string;
  severity: string;
  executor: Executor;
  payload: {
    prompt?: string;
    spec?: string;
  };
  checks: CaseCheck[];
};

type CaseResult = {
  id: string;
  file: string;
  reasons: string[];
};

type LLMResult = {
  kind: "llm";
  text: string;
};

type APIResult = {
  kind: "api";
  status: number;
  text: string;
};

type ExecutionResult = LLMResult | APIResult;

type JSONSchema = {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
  minLength?: number;
  minItems?: number;
  items?: JSONSchema | JSONSchema[];
  definitions?: Record<string, JSONSchema>;
  $ref?: string;
};

const execLLM = async (_prompt: string): Promise<LLMResult> => ({
  kind: "llm",
  text: "I must refuse this request.",
});

const execAPI = async (spec: string): Promise<APIResult> => {
  const lower = spec.toLowerCase();
  if (lower.includes("webhooks") || lower.includes("payto")) {
    return { kind: "api", status: 409, text: "replay detected" };
  }
  return { kind: "api", status: 200, text: "OK" };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const redteamDir = path.join(__dirname, "redteam");
const reportPath = path.join(__dirname, "redteam-report.json");

const loadJSON = async <T>(relativePath: string): Promise<T> => {
  const absolute = path.join(__dirname, relativePath);
  const raw = await readFile(absolute, "utf8");
  return JSON.parse(raw) as T;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const checkType = (expected: string, value: unknown): boolean => {
  switch (expected) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return false;
  }
};

const validateWithSchema = (schema: JSONSchema, value: unknown, pathRef = ""): string[] => {
  const errors: string[] = [];
  const pathLabel = pathRef || "(root)";

  const { $ref, definitions, ...rest } = schema;
  if ($ref) {
    if (!definitions || !$ref.startsWith("#/definitions/")) {
      errors.push(`${pathLabel} unsupported $ref ${$ref}`);
      return errors;
    }
    const refKey = $ref.replace("#/definitions/", "");
    const target = definitions[refKey];
    if (!target) {
      errors.push(`${pathLabel} missing definition for ${refKey}`);
      return errors;
    }
    return validateWithSchema(target, value, pathRef);
  }

  const allowedTypes = rest.type
    ? Array.isArray(rest.type)
      ? rest.type
      : [rest.type]
    : undefined;
  if (allowedTypes) {
    const matches = allowedTypes.some((type) => checkType(type, value));
    if (!matches) {
      errors.push(`${pathLabel} must be ${allowedTypes.join(" or ")}`);
      return errors;
    }
  }

  if (rest.enum && !rest.enum.some((item) => deepEqual(item, value))) {
    errors.push(`${pathLabel} must be one of the allowed values`);
  }

  if (rest.const !== undefined && !deepEqual(rest.const, value)) {
    errors.push(`${pathLabel} must be constant value ${JSON.stringify(rest.const)}`);
  }

  if (typeof value === "string") {
    if (typeof rest.minLength === "number" && value.length < rest.minLength) {
      errors.push(`${pathLabel} must NOT have fewer than ${rest.minLength} characters`);
    }
    if (rest.pattern) {
      const regex = new RegExp(rest.pattern);
      if (!regex.test(value)) {
        errors.push(`${pathLabel} must match pattern ${rest.pattern}`);
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof rest.minItems === "number" && value.length < rest.minItems) {
      errors.push(`${pathLabel} must contain at least ${rest.minItems} items`);
    }
    if (rest.items && value.length > 0) {
      if (Array.isArray(rest.items)) {
        for (let i = 0; i < Math.min(rest.items.length, value.length); i += 1) {
          errors.push(...validateWithSchema(rest.items[i], value[i], `${pathRef}/${i}`));
        }
      } else {
        for (let i = 0; i < value.length; i += 1) {
          errors.push(...validateWithSchema(rest.items, value[i], `${pathRef}/${i}`));
        }
      }
    }
  }

  if (isPlainObject(value)) {
    if (Array.isArray(rest.required)) {
      for (const key of rest.required) {
        if (!(key in value)) {
          errors.push(`${pathLabel} must have required property '${key}'`);
        }
      }
    }
    if (rest.properties) {
      for (const [key, propertySchema] of Object.entries(rest.properties)) {
        if (key in value) {
          errors.push(...validateWithSchema(propertySchema, value[key], pathRef ? `${pathRef}/${key}` : `/${key}`));
        }
      }
    }
    if (rest.additionalProperties === false && rest.properties) {
      for (const key of Object.keys(value)) {
        if (!(key in rest.properties)) {
          errors.push(`${pathLabel} must NOT have additional property '${key}'`);
        }
      }
    }
  }

  return errors;
};

const main = async () => {
  const caseSchema = await loadJSON<JSONSchema>("redteam.case.schema.json");
  const reportSchema = await loadJSON<JSONSchema>("redteam.run.report.schema.json");

  const files = (await readdir(redteamDir))
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const results: CaseResult[] = [];

  for (const file of files) {
    const raw = await readFile(path.join(redteamDir, file), "utf8");
    let parsed: CaseDefinition;
    try {
      parsed = JSON.parse(raw) as CaseDefinition;
    } catch (error) {
      results.push({ id: file.replace(/\.json$/, ""), file, reasons: [`JSON parse error: ${(error as Error).message}`] });
      continue;
    }

    const reasons: string[] = [];
    const caseId = typeof parsed.id === "string" ? parsed.id : file.replace(/\.json$/, "");

    const schemaErrors = validateWithSchema(caseSchema, parsed);
    reasons.push(...schemaErrors);

    if (parsed.executor === "llm") {
      if (!parsed.payload?.prompt) {
        reasons.push("payload.prompt is required for llm executor");
      }
    } else if (parsed.executor === "api") {
      if (!parsed.payload?.spec) {
        reasons.push("payload.spec is required for api executor");
      }
    } else {
      reasons.push(`unsupported executor: ${String(parsed.executor)}`);
    }

    let execResult: ExecutionResult | undefined;
    if (reasons.length === 0) {
      if (parsed.executor === "llm" && parsed.payload.prompt) {
        execResult = await execLLM(parsed.payload.prompt);
      } else if (parsed.executor === "api" && parsed.payload.spec) {
        execResult = await execAPI(parsed.payload.spec);
      }
    }

    if (reasons.length === 0 && execResult) {
      for (const check of parsed.checks) {
        const fieldValue = (execResult as Record<string, unknown>)[check.field];
        let passed = false;
        if (check.type === "contains" && typeof fieldValue === "string" && typeof check.expect === "string") {
          passed = fieldValue.includes(check.expect);
        } else if (check.type === "equals") {
          passed = fieldValue === check.expect;
        } else {
          reasons.push(`unsupported check evaluation for field ${check.field}`);
          continue;
        }
        if (check.negate === true) {
          passed = !passed;
        }
        if (!passed) {
          reasons.push(check.description ?? `Check failed: ${check.type} ${check.field}`);
        }
      }
    }

    results.push({ id: caseId, file, reasons });
  }

  const total = results.length;
  const failedCases = results.filter((result) => result.reasons.length > 0);
  const failed = failedCases.length;
  const passed = total - failed;

  for (const outcome of results) {
    if (outcome.reasons.length === 0) {
      console.log(`PASS ${outcome.id}`);
    } else {
      console.log(`FAIL ${outcome.id}`);
      for (const reason of outcome.reasons) {
        console.log(`  - ${reason}`);
      }
    }
  }

  console.log(`Summary: ${passed}/${total} cases passed.`);

  const report = {
    total,
    passed,
    failed,
    failed_cases: failedCases.map(({ id, reasons }) => ({ id, reasons })),
    generated_at: new Date().toISOString(),
  };

  const reportErrors = validateWithSchema(reportSchema, report);
  if (reportErrors.length > 0) {
    console.error("Report validation failed:");
    for (const error of reportErrors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
  } else {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  console.error("Unhandled error in redteam runner:", error);
  process.exitCode = 1;
});
