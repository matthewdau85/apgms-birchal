import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const redteamCaseSchema = z.object({
  id: z.string(),
  category: z.enum([
    "prompt_injection",
    "system_prompt_reveal",
    "data_exfiltration",
    "scope_creep",
    "no_answer",
    "conflicting_sources",
    "tool_abuse",
    "toxic_language"
  ]),
  title: z.string(),
  prompt: z.string(),
  expected_behavior: z.string(),
  recommended_response: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["pass", "fail"]),
  tags: z.array(z.string()),
  notes: z.string().optional()
});

type RedteamCase = z.infer<typeof redteamCaseSchema>;

type CategorySummary = {
  total: number;
  pass: number;
  fail: number;
};

type SeveritySummary = {
  total: number;
  fail: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const redteamDir = path.join(__dirname, "redteam");
const reportPath = path.join(__dirname, "redteam-report.json");

if (!fs.existsSync(redteamDir)) {
  console.error(`Red-team directory not found: ${redteamDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(redteamDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

let total = 0;
let validCount = 0;
let passCount = 0;
let failCount = 0;
const invalidFiles: string[] = [];
const criticalFailures: Array<{ id: string; file: string }> = [];
const categoryMap = new Map<RedteamCase["category"], CategorySummary>();
const severityMap = new Map<RedteamCase["severity"], SeveritySummary>();

for (const file of files) {
  total += 1;
  const fullPath = path.join(redteamDir, file);
  let parsed: unknown;
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    invalidFiles.push(`${file}: ${(error as Error).message}`);
    continue;
  }

  const result = redteamCaseSchema.safeParse(parsed);
  if (!result.success) {
    invalidFiles.push(`${file}: ${result.error.issues.map((issue) => issue.message).join(", ")}`);
    continue;
  }

  validCount += 1;
  const record = result.data;

  const categoryStats = categoryMap.get(record.category) ?? { total: 0, pass: 0, fail: 0 };
  categoryStats.total += 1;
  const severityStats = severityMap.get(record.severity) ?? { total: 0, fail: 0 };
  severityStats.total += 1;

  if (record.status === "pass") {
    passCount += 1;
    categoryStats.pass += 1;
  } else {
    failCount += 1;
    categoryStats.fail += 1;
    severityStats.fail += 1;
    if (record.severity === "critical") {
      criticalFailures.push({ id: record.id, file });
    }
  }

  categoryMap.set(record.category, categoryStats);
  severityMap.set(record.severity, severityStats);
}

const report = {
  generated_at: new Date().toISOString(),
  totals: {
    files_discovered: total,
    valid_cases: validCount,
    pass: passCount,
    fail: failCount
  },
  category_summary: Object.fromEntries(categoryMap.entries()),
  severity_summary: Object.fromEntries(severityMap.entries()),
  invalid_files: invalidFiles,
  critical_failures: criticalFailures
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (criticalFailures.length > 0) {
  process.exit(1);
}

