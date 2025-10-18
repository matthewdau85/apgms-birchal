import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deepStrictEqual } from "node:assert/strict";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenDir = path.join(__dirname, "golden");

const AmountValueSchema = z.union([
  z
    .number({ invalid_type_error: "amount must be a number or string" })
    .refine((value) => Number.isFinite(value), "amount must be finite"),
  z.string().min(1, "amount string must not be empty"),
]);

const PayloadSchema = z.object({
  type: z.enum(["credit", "debit"]),
  amount: z.object({
    value: AmountValueSchema,
    currency: z.string().min(1, "currency is required"),
  }),
  narrative: z.string().min(1, "narrative is required"),
  timestamp: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "timestamp must be ISO-8601"),
});

const InputSchema = z.object({
  org_id: z.string().min(1, "org_id is required"),
  gate_open: z.boolean(),
  payload: PayloadSchema,
});

const LedgerSchema = z.object({
  debit: z.number(),
  credit: z.number(),
  net: z.number(),
  currency: z.string(),
});

const ResultSchema = z.object({
  normalizedAmount: z.number(),
  ledger: LedgerSchema,
});

const GateSchema = z.object({
  open: z.boolean(),
  reason: z.string().optional(),
});

const ExpectedSchema = z
  .object({
    status: z.number().int().min(100).max(599),
    body: z.object({
      ok: z.boolean(),
      result: ResultSchema.optional(),
      error: z.string().optional(),
      gate: GateSchema,
    }),
  })
  .refine((value) => {
    if (value.body.ok) {
      return value.body.result !== undefined;
    }
    return value.body.error !== undefined;
  }, "ok=true cases must include result, ok=false cases must include error");

const GoldenCaseSchema = z.object({
  name: z.string(),
  tags: z.array(z.string()).optional().default([]),
  input: InputSchema,
  expected: ExpectedSchema,
});

const GoldenFileSchema = z.object({
  description: z.string(),
  cases: z.array(GoldenCaseSchema).min(1),
});

type GoldenCase = z.infer<typeof GoldenCaseSchema>;
type GoldenFile = z.infer<typeof GoldenFileSchema>;
type ExecutionResult = GoldenCase["expected"];

const GATE_CLOSED_REASON = "engine_maintenance";

function parseAmount(value: number | string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("invalid numeric amount");
    }
    return value;
  }

  const cleaned = value
    .trim()
    .replace(/[,_\sA-Za-z$]/g, "")
    .replace(/^[+]/, "+")
    .replace(/^-/, "-");

  if (cleaned.length === 0 || cleaned === "." || cleaned === "+" || cleaned === "-") {
    throw new Error("invalid string amount");
  }

  if (!/^[-+]?\d*(?:\.\d*)?$/.test(cleaned)) {
    throw new Error("invalid string amount format");
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new Error("invalid parsed amount");
  }

  return parsed;
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const roundedAbs = Math.round(Math.abs(value) * 100);
  const rounded = (roundedAbs * sign) / 100;
  return Number(rounded.toFixed(2));
}

function enforceLedgerInvariants(value: number, currency: string) {
  const debit = value < 0 ? Number((-value).toFixed(2)) : 0;
  const credit = value > 0 ? Number(value.toFixed(2)) : 0;

  return {
    normalizedAmount: Number(value.toFixed(2)),
    ledger: {
      debit,
      credit,
      net: Number(value.toFixed(2)),
      currency,
    },
  } as const;
}

function executeCase(input: z.infer<typeof InputSchema>): ExecutionResult {
  if (!input.gate_open) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "engine_gate_closed",
        gate: { open: false, reason: GATE_CLOSED_REASON },
      },
    };
  }

  let amount: number;
  try {
    amount = parseAmount(input.payload.amount.value);
  } catch (error) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "invalid_amount",
        gate: { open: true },
      },
    };
  }

  const signed = input.payload.type === "debit" ? -Math.abs(amount) : Math.abs(amount);
  const rounded = roundToCents(signed);
  const result = enforceLedgerInvariants(rounded, input.payload.amount.currency);

  return {
    status: 201,
    body: {
      ok: true,
      gate: { open: true },
      result,
    },
  };
}

async function loadGoldenFiles(): Promise<Array<{ file: string; data: GoldenFile; raw: unknown }>> {
  const entries = await fs.readdir(goldenDir);
  const files: Array<{ file: string; data: GoldenFile; raw: unknown }> = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json") || entry === "_schema.json") {
      continue;
    }

    const rawText = await fs.readFile(path.join(goldenDir, entry), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      console.error(`Failed to parse JSON for ${entry}:`, error);
      continue;
    }

    const result = GoldenFileSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`Schema mismatch for ${entry}:`, result.error.toString());
      continue;
    }

    files.push({ file: entry, data: result.data, raw: parsed });
  }

  return files;
}

async function main() {
  const files = await loadGoldenFiles();

  let totalCases = 0;
  let schemaValidCases = 0;
  let executedCases = 0;
  let passedCases = 0;
  const failures: Array<{ file: string; caseName: string; reason: string }> = [];

  const allEntries = await fs.readdir(goldenDir);
  for (const entry of allEntries) {
    if (!entry.endsWith(".json") || entry === "_schema.json") {
      continue;
    }

    const rawText = await fs.readFile(path.join(goldenDir, entry), "utf8");
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).cases)) {
      totalCases += (parsed as any).cases.length;
    }
  }

  for (const { file, data } of files) {
    schemaValidCases += data.cases.length;

    for (const goldenCase of data.cases) {
      executedCases += 1;
      try {
        const actual = executeCase(goldenCase.input);
        deepStrictEqual(actual, goldenCase.expected);
        passedCases += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ file, caseName: goldenCase.name, reason });
      }
    }
  }

  const schemaValidity = totalCases === 0 ? 1 : schemaValidCases / totalCases;
  const passRate = executedCases === 0 ? 0 : passedCases / executedCases;

  const summary = {
    totalFiles: files.length,
    totalCases,
    schemaValidCases,
    executedCases,
    passedCases,
    schemaValidity: Number(schemaValidity.toFixed(4)),
    passRate: Number(passRate.toFixed(4)),
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (schemaValidity < 0.98 || passRate < 0.9) {
    console.error("Golden gate failed: schema or pass rate below threshold");
    process.exit(1);
  }

  if (failures.length > 0) {
    console.error("Golden gate failed cases: ", failures);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Golden gate execution error", error);
  process.exit(1);
});
