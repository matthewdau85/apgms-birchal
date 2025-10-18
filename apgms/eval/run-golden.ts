import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface CaseSchema {
  required?: string[];
  properties?: Record<string, { type?: string }>;
}

interface GoldenCase {
  route: string;
  input: Record<string, unknown>;
  expect: Record<string, unknown>;
}

type Handler = (input: Record<string, unknown>) => Record<string, unknown>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenDir = path.join(__dirname, "golden");
const schemaPath = path.join(goldenDir, "_schema.json");

function loadJSON<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function validateAgainstSchema(schema: CaseSchema, data: Record<string, unknown>): boolean {
  if (!schema.required) {
    return true;
  }

  for (const field of schema.required) {
    if (!(field in data)) {
      return false;
    }
    const expectedType = schema.properties?.[field]?.type;
    if (expectedType) {
      const value = data[field];
      if (expectedType === "object") {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return false;
        }
      } else if (typeof value !== expectedType) {
        return false;
      }
    }
  }

  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => deepEqual(value, b[index]));
  }

  if (typeof a === "object" && a !== null && b !== null) {
    const aKeys = Object.keys(a as Record<string, unknown>).sort();
    const bKeys = Object.keys(b as Record<string, unknown>).sort();
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (let i = 0; i < aKeys.length; i += 1) {
      if (aKeys[i] !== bKeys[i]) {
        return false;
      }
    }
    return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }

  return false;
}

const handlers: Record<string, Handler> = {
  dashboard: (input) => {
    const metrics = Array.isArray(input.metrics) ? input.metrics : [];
    const total = metrics
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);
    return {
      status: "ok",
      total,
    };
  },
  "allocations.preview": (input) => {
    const rawAmount = input.amount;
    const amount = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount));
    const allocationCount = typeof input.allocationCount === "number" && input.allocationCount > 0 ? input.allocationCount : 1;
    const perAllocation = Math.round((amount / allocationCount) * 100) / 100;
    return {
      status: "ok",
      perAllocation,
      currency: typeof input.currency === "string" ? input.currency : "",
    };
  },
  "allocations.apply": (input) => {
    const gateOpen = Boolean(input.gateOpen);
    if (!gateOpen) {
      return {
        status: "blocked",
        reason: "gate_closed",
      };
    }
    return {
      status: "applied",
      allocationId: String(input.allocationId ?? ""),
    };
  },
};

function run(): void {
  if (!fs.existsSync(goldenDir)) {
    throw new Error(`Golden directory not found at ${goldenDir}`);
  }

  const schema = loadJSON<CaseSchema>(schemaPath);
  const caseFiles = fs
    .readdirSync(goldenDir)
    .filter((file) => file.endsWith(".json") && file !== "_schema.json")
    .sort();

  const results = [] as {
    file: string;
    validSchema: boolean;
    passed: boolean;
    actual: Record<string, unknown> | null;
    expected: Record<string, unknown> | null;
  }[];

  let validCount = 0;
  let passCount = 0;

  for (const fileName of caseFiles) {
    const filePath = path.join(goldenDir, fileName);
    const testCase = loadJSON<GoldenCase>(filePath);
    const validSchema = validateAgainstSchema(schema, testCase as Record<string, unknown>);
    if (validSchema) {
      validCount += 1;
    }

    const handler = handlers[testCase.route];
    let actual: Record<string, unknown> | null = null;
    let passed = false;

    if (validSchema && handler) {
      actual = handler(testCase.input);
      passed = deepEqual(actual, testCase.expect);
    }

    if (passed) {
      passCount += 1;
    }

    results.push({
      file: fileName,
      validSchema,
      passed,
      actual,
      expected: testCase.expect,
    });
  }

  const total = caseFiles.length || 1;
  const schemaValidity = validCount / total;
  const passRate = passCount / total;

  console.log("Golden case results:");
  for (const result of results) {
    console.log(
      `${result.file}: schema=${result.validSchema ? "valid" : "invalid"}, pass=${result.passed ? "yes" : "no"}`,
    );
    if (!result.passed && result.actual) {
      console.log("  expected:", JSON.stringify(result.expected));
      console.log("  actual:", JSON.stringify(result.actual));
    }
  }

  console.log("");
  console.log(`schema_validity=${schemaValidity.toFixed(2)}`);
  console.log(`pass_rate=${passRate.toFixed(2)}`);

  if (schemaValidity < 0.98 || passRate < 0.90) {
    console.error("Golden tests failed minimum thresholds.");
    process.exit(1);
  }
}

run();
