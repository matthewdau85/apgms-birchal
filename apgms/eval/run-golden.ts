import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const goldenCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  input: z.object({
    orgId: z.string(),
    bankLineId: z.string(),
    rptId: z.string(),
    policyId: z.string(),
    gateId: z.string(),
    idempotencyKey: z.string(),
    gate: z.enum(["OPEN", "CLOSED"]),
    memo: z.string().nullable().optional(),
    amount: z.union([z.number(), z.string()]),
    currency: z.string(),
    override: z.object({
      requested: z.boolean(),
      role: z.string().min(1).nullable()
    }),
    documents: z.array(z.string())
  }),
  expected: z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.enum([
      "approved",
      "override_review",
      "gate_closed",
      "memo_required",
      "override_role_required"
    ]),
    memoRequired: z.boolean()
  })
});

type GoldenCase = z.infer<typeof goldenCaseSchema>;

type EvaluationResult = {
  decision: "APPROVED" | "REJECTED";
  reason: "approved" | "override_review" | "gate_closed" | "memo_required" | "override_role_required";
  memoRequired: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenDir = path.join(__dirname, "golden");

if (!fs.existsSync(goldenDir)) {
  console.error(`Golden directory not found: ${goldenDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(goldenDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

let total = 0;
let validCount = 0;
let passCount = 0;
const invalidFiles: string[] = [];
const mismatches: Array<{
  id: string;
  file: string;
  expected: GoldenCase["expected"];
  actual: EvaluationResult;
}> = [];

for (const file of files) {
  total += 1;
  const fullPath = path.join(goldenDir, file);
  let parsed: unknown;
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    invalidFiles.push(`${file}: ${(error as Error).message}`);
    continue;
  }

  const result = goldenCaseSchema.safeParse(parsed);
  if (!result.success) {
    invalidFiles.push(`${file}: ${result.error.issues.map((issue) => issue.message).join(", ")}`);
    continue;
  }

  validCount += 1;
  const record = result.data;
  let actual: EvaluationResult;
  try {
    actual = evaluateCase(record.input);
  } catch (error) {
    invalidFiles.push(`${file}: ${(error as Error).message}`);
    validCount -= 1;
    continue;
  }

  const matches =
    actual.decision === record.expected.decision &&
    actual.reason === record.expected.reason &&
    actual.memoRequired === record.expected.memoRequired;

  if (matches) {
    passCount += 1;
  } else {
    mismatches.push({ id: record.id, file, expected: record.expected, actual });
  }
}

const schemaValidity = total === 0 ? 0 : validCount / total;
const passRate = validCount === 0 ? 0 : passCount / validCount;

const summary = {
  total_cases: total,
  schema_validity: Number(schemaValidity.toFixed(4)),
  pass_rate: Number(passRate.toFixed(4)),
  invalid_files: invalidFiles,
  mismatches
};

console.log(JSON.stringify(summary, null, 2));

if (schemaValidity < 0.98 || passRate < 0.9) {
  process.exit(1);
}

function evaluateCase(input: GoldenCase["input"]): EvaluationResult {
  if (input.gate === "CLOSED") {
    return {
      decision: "REJECTED",
      reason: "gate_closed",
      memoRequired: false
    };
  }

  const amount = normaliseAmount(input.amount);
  const memoText = (input.memo ?? "").trim();
  const memoRequired = amount >= 50000 || input.override.requested;

  if (input.override.requested && !input.override.role) {
    return {
      decision: "REJECTED",
      reason: "override_role_required",
      memoRequired
    };
  }

  if (memoRequired && memoText.length === 0) {
    return {
      decision: "REJECTED",
      reason: "memo_required",
      memoRequired
    };
  }

  if (input.override.requested) {
    return {
      decision: "APPROVED",
      reason: "override_review",
      memoRequired
    };
  }

  return {
    decision: "APPROVED",
    reason: "approved",
    memoRequired
  };
}

function normaliseAmount(amount: GoldenCase["input"]["amount"]): number {
  if (typeof amount === "number") {
    return amount;
  }

  const cleaned = amount.replace(/[_,\s]/g, "").replace(/,/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse amount: ${amount}`);
  }
  return parsed;
}

