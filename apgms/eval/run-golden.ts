import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PrimitiveType = "string" | "number" | "boolean" | "object" | "array";

type JSONSchema = {
  type?: PrimitiveType;
  required?: string[];
  properties?: Record<string, JSONSchema>;
  additionalProperties?: boolean;
  enum?: unknown[];
  pattern?: string;
  minLength?: number;
  minimum?: number;
  maximum?: number;
  items?: JSONSchema;
};

type GoldenCase = {
  id: string;
  category: string;
  actual: { passed: boolean };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const casesDir = path.join(__dirname, "golden");
const schemaPath = path.join(repoRoot, "prompts", "schema.json");
const reportPath = path.join(__dirname, "golden-report.json");

const THRESHOLDS = {
  schema_validity: 0.98,
  pass_rate: 0.9,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getType(value: unknown): PrimitiveType {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "object";
  }

  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return t;
  }

  return "object";
}

function validateAgainstSchema(schema: JSONSchema, value: unknown, pathRef = "$", errors: string[] = []): string[] {
  if (schema.type) {
    const actualType = getType(value);
    if (schema.type !== actualType) {
      errors.push(`${pathRef}: expected type ${schema.type}, received ${actualType}`);
      return errors;
    }
  }

  if (schema.enum && !schema.enum.some((option) => Object.is(option, value))) {
    errors.push(`${pathRef}: value ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
    return errors;
  }

  if (schema.type === "string" && typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${pathRef}: expected minimum length ${schema.minLength}`);
    }
    if (schema.pattern) {
      const pattern = new RegExp(schema.pattern);
      if (!pattern.test(value)) {
        errors.push(`${pathRef}: value does not match pattern ${schema.pattern}`);
      }
    }
  }

  if (schema.type === "number" && typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${pathRef}: value ${value} below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${pathRef}: value ${value} above maximum ${schema.maximum}`);
    }
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${pathRef}: expected array`);
    } else if (schema.items) {
      value.forEach((entry, index) => {
        validateAgainstSchema(schema.items as JSONSchema, entry, `${pathRef}[${index}]`, errors);
      });
    }
  }

  if (schema.type === "object") {
    if (!isRecord(value)) {
      errors.push(`${pathRef}: expected object`);
      return errors;
    }

    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${pathRef}.${key}: missing required property`);
      }
    }

    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(properties)) {
      if (key in value) {
        validateAgainstSchema(child, value[key], `${pathRef}.${key}`, errors);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${pathRef}.${key}: additional properties are not permitted`);
        }
      }
    }
  }

  return errors;
}

function loadSchema(): JSONSchema {
  try {
    const contents = readFileSync(schemaPath, "utf8");
    return JSON.parse(contents) as JSONSchema;
  } catch (error) {
    console.error(`Failed to load schema from ${schemaPath}:`, error);
    process.exit(1);
  }
}

function readCase(filePath: string): unknown {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function main() {
    const schema = loadSchema();
    const files = readdirSync(casesDir)
      .filter((file) => file.endsWith(".json") && file !== "_schema.json")
      .sort();

    if (files.length === 0) {
      console.error("No golden cases found. Expected JSON files in eval/golden/");
      process.exit(1);
    }

    const results = files.map((file) => {
      const fullPath = path.join(casesDir, file);
      const data = readCase(fullPath);
      const errors = validateAgainstSchema(schema, data, "$", []);
      const schemaValid = errors.length === 0;

      let passed = false;
      let caseId = file;
      let category = "unknown";

      if (isRecord(data)) {
        if (typeof data.id === "string") {
          caseId = data.id;
        }
        if (typeof data.category === "string") {
          category = data.category;
        }
        if (isRecord(data.actual) && typeof data.actual.passed === "boolean") {
          passed = data.actual.passed;
        }
      }

      return {
        file,
        id: caseId,
        category,
        schemaValid,
        passed,
        errors,
      };
    });

    const totalCases = results.length;
    const validCount = results.filter((entry) => entry.schemaValid).length;
    const passCount = results.filter((entry) => entry.passed).length;

    const schemaValidity = totalCases === 0 ? 0 : validCount / totalCases;
    const passRate = totalCases === 0 ? 0 : passCount / totalCases;

    const report = {
      generated_at: new Date().toISOString(),
      totals: {
        cases: totalCases,
        schema_valid: validCount,
        passes: passCount,
      },
      metrics: {
        schema_validity: schemaValidity,
        pass_rate: passRate,
      },
      thresholds: THRESHOLDS,
      cases: results,
    };

    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const schemaOk = schemaValidity >= THRESHOLDS.schema_validity;
    const passOk = passRate >= THRESHOLDS.pass_rate;

    console.log(`Golden evaluation: schema_validity=${schemaValidity.toFixed(2)}, pass_rate=${passRate.toFixed(2)}`);

    if (!schemaOk || !passOk) {
      console.error(`Threshold check failed. Required schema_validity >= ${THRESHOLDS.schema_validity} and pass_rate >= ${THRESHOLDS.pass_rate}.`);
      process.exitCode = 1;
    }
}

main();
