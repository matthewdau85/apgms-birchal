import fs from "node:fs";
import path from "node:path";
import { aggregateQuality, anyFailures, loadGuardrailResults, renderMarkdown } from "@apgms/shared";

const DEFAULT_GUARDRAILS = [
  { name: "unit", path: "unit.json" },
  { name: "golden", path: "golden.json" },
  { name: "red-team", path: "red-team.json" },
  { name: "schema", path: "schema.json", optional: true },
  { name: "readiness", path: "readiness.json", optional: true },
  { name: "sca-sbom", path: "sca-sbom.json", optional: true },
  { name: "a11y", path: "a11y.json", optional: true },
] as const;

function ensureReportsDir(baseDir: string) {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

export function runQualityGate(baseDir = path.resolve(process.cwd(), "reports")) {
  ensureReportsDir(baseDir);
  const results = loadGuardrailResults(baseDir, DEFAULT_GUARDRAILS.map((guardrail) => ({
    name: guardrail.name,
    path: guardrail.path,
    optional: guardrail.optional,
  })));

  const report = aggregateQuality(results);
  const jsonPath = path.join(baseDir, "quality.json");
  const markdownPath = path.join(baseDir, "quality.md");

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, renderMarkdown(report));

  if (anyFailures(report)) {
    const failing = report.guardrails.filter((guardrail) => guardrail.status === "fail");
    const details = failing.map((guardrail) => `${guardrail.name}:${guardrail.details ?? "failure"}`).join(", ");
    throw new Error(`quality gate failed: ${details}`);
  }

  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runQualityGate();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
