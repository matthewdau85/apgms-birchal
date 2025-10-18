import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

const CASE_SCHEMA = z.object({
  name: z.string(),
  description: z.string(),
  input: z.object({
    gate: z.object({
      open: z.boolean(),
      threshold: z.number().min(0).max(1),
    }),
    transactions: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(["credit", "debit"]),
          amount: z.union([z.number(), z.string()]),
          risk_score: z.number().min(0).max(1),
          note: z.string().nullable().optional(),
        })
      )
      .min(1),
  }),
  expected: z.object({
    gate_open: z.boolean(),
    approved: z.object({
      ids: z.array(z.string()),
      total: z.number(),
    }),
    rejected: z.object({
      ids: z.array(z.string()),
      total: z.number(),
    }),
    net: z.number(),
  }),
});

type EngineGoldenCase = z.infer<typeof CASE_SCHEMA>;

type EngineGoldenResult = EngineGoldenCase["expected"];

type CaseOutcome = {
  file: string;
  schemaValid: boolean;
  passed: boolean;
  reason?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOLDEN_DIR = path.resolve(__dirname, "golden");

async function loadCase(file: string): Promise<EngineGoldenCase> {
  const raw = await fs.readFile(path.join(GOLDEN_DIR, file), "utf8");
  const parsed = JSON.parse(raw);
  const validation = CASE_SCHEMA.safeParse(parsed);
  if (!validation.success) {
    const messages = validation.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Schema validation failed: ${messages}`);
  }
  return validation.data;
}

function parseAmount(raw: number | string): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      throw new Error(`Non-finite numeric amount: ${raw}`);
    }
    return raw;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Amount string cannot be empty");
  }
  const parsed = Number.parseFloat(trimmed.replace(/_/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse amount string: ${raw}`);
  }
  return parsed;
}

function normaliseAmount(value: number, type: "credit" | "debit"): number {
  const magnitude = Math.abs(value);
  const signed = type === "credit" ? magnitude : -magnitude;
  return Math.round(signed * 100) / 100;
}

function evaluateCase(data: EngineGoldenCase): EngineGoldenResult {
  const effectiveGateOpen = data.input.gate.open === true;
  const approvedIds: string[] = [];
  const rejectedIds: string[] = [];
  let approvedTotal = 0;
  let rejectedTotal = 0;

  for (const tx of data.input.transactions) {
    const parsedAmount = parseAmount(tx.amount);
    const normalised = normaliseAmount(parsedAmount, tx.type);
    const qualifies = effectiveGateOpen && tx.risk_score <= data.input.gate.threshold;
    if (qualifies) {
      approvedIds.push(tx.id);
      approvedTotal += normalised;
    } else {
      rejectedIds.push(tx.id);
      rejectedTotal += normalised;
    }
  }

  approvedTotal = Math.round(approvedTotal * 100) / 100;
  rejectedTotal = Math.round(rejectedTotal * 100) / 100;
  const net = Math.round((approvedTotal + rejectedTotal) * 100) / 100;

  return {
    gate_open: effectiveGateOpen,
    approved: {
      ids: approvedIds,
      total: approvedTotal,
    },
    rejected: {
      ids: rejectedIds,
      total: rejectedTotal,
    },
    net,
  };
}

async function run(): Promise<number> {
  const entries = await fs.readdir(GOLDEN_DIR);
  const caseFiles = entries.filter((file) => file.endsWith(".json") && file !== "_schema.json").sort();
  if (caseFiles.length === 0) {
    console.warn("No golden cases discovered.");
    return 1;
  }

  const outcomes: CaseOutcome[] = [];

  for (const file of caseFiles) {
    try {
      const data = await loadCase(file);
      const actual = evaluateCase(data);
      const passed = isDeepStrictEqual(actual, data.expected);
      outcomes.push({
        file,
        schemaValid: true,
        passed,
        reason: passed
          ? undefined
          : `Output mismatch. Expected ${JSON.stringify(data.expected)} but received ${JSON.stringify(actual)}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ file, schemaValid: false, passed: false, reason: message });
    }
  }

  const totalCases = outcomes.length;
  const validCases = outcomes.filter((outcome) => outcome.schemaValid).length;
  const passedCases = outcomes.filter((outcome) => outcome.passed).length;

  const schemaValidity = totalCases === 0 ? 0 : validCases / totalCases;
  const passRate = totalCases === 0 ? 0 : passedCases / totalCases;

  console.log("Golden case results:\n");
  for (const outcome of outcomes) {
    const status = outcome.schemaValid && outcome.passed ? "PASS" : "FAIL";
    console.log(`- ${outcome.file}: ${status}`);
    if (outcome.reason && status === "FAIL") {
      console.log(`    Reason: ${outcome.reason}`);
    }
  }

  console.log("");
  console.log(`schema_validity: ${schemaValidity.toFixed(3)}`);
  console.log(`pass_rate: ${passRate.toFixed(3)}`);

  const failures: string[] = [];
  if (schemaValidity < 0.98) {
    failures.push(`schema_validity ${schemaValidity.toFixed(3)} below 0.98`);
  }
  if (passRate < 0.9) {
    failures.push(`pass_rate ${passRate.toFixed(3)} below 0.90`);
  }

  if (failures.length > 0) {
    console.error("\nGolden evaluation failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    return 1;
  }

  return 0;
}

run()
  .then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
