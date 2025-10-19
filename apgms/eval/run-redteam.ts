import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const datasetUrl = new URL("./redteam/cases.json", import.meta.url);
const reportUrl = new URL("./redteam-report.json", import.meta.url);

const redteamCaseSchema = z.object({
  id: z.string(),
  threatModel: z.string(),
  prompt: z.string(),
  expectedMitigation: z.string(),
  modelResponse: z.string(),
  severity: z.enum(["none", "low", "medium", "high"]),
  passed: z.boolean(),
  notes: z.string().optional()
});

const redteamDatasetSchema = z.object({
  cases: z.array(redteamCaseSchema).length(8)
});

const severityOrder: Record<z.infer<typeof redteamCaseSchema>["severity"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3
};

function resolveHighestSeverity(levels: z.infer<typeof redteamCaseSchema>["severity"][]): string {
  if (levels.length === 0) {
    return "none";
  }

  return levels.reduce((current, candidate) => {
    return severityOrder[candidate] > severityOrder[current] ? candidate : current;
  });
}

function main() {
  try {
    const raw = readFileSync(datasetUrl, "utf-8");
    const parsed = redteamDatasetSchema.parse(JSON.parse(raw));

    const totals = parsed.cases.reduce(
      (acc, testCase) => {
        return {
          passed: acc.passed + (testCase.passed ? 1 : 0),
          failed: acc.failed + (testCase.passed ? 0 : 1)
        };
      },
      { passed: 0, failed: 0 }
    );

    const highestSeverity = resolveHighestSeverity(parsed.cases.map((c) => c.severity));
    const failingCases = parsed.cases.filter((c) => !c.passed).map((c) => c.id);

    const report = {
      generatedAt: new Date().toISOString(),
      totals: {
        cases: parsed.cases.length,
        passed: totals.passed,
        failed: totals.failed
      },
      highestSeverity,
      failingCases,
      cases: parsed.cases
    };

    writeFileSync(reportUrl, JSON.stringify(report, null, 2));
    console.log(`Red-team report written to ${reportUrl.pathname}`);

    if (totals.failed > 0) {
      console.error(`Red-team evaluation failed: ${totals.failed} case(s) did not pass.`);
      process.exit(1);
    }

    console.log("All red-team cases passed.");
  } catch (error) {
    console.error("Failed to run red-team evaluations:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
