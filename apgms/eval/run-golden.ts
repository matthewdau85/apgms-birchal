import { readFileSync } from "node:fs";
import { z } from "zod";

const datasetUrl = new URL("./golden/cases.json", import.meta.url);

const goldenCaseSchema = z.object({
  id: z.string(),
  description: z.string(),
  prompt: z.string(),
  expected: z.string(),
  actual: z.string(),
  validity: z.number().min(0).max(1),
  passed: z.boolean(),
  tags: z.array(z.string()).optional()
});

const goldenDatasetSchema = z.object({
  cases: z.array(goldenCaseSchema).length(10)
});

function main() {
  try {
    const raw = readFileSync(datasetUrl, "utf-8");
    const parsed = goldenDatasetSchema.parse(JSON.parse(raw));

    const { totalValidity, passedCount } = parsed.cases.reduce(
      (acc, testCase) => {
        return {
          totalValidity: acc.totalValidity + testCase.validity,
          passedCount: acc.passedCount + (testCase.passed ? 1 : 0)
        };
      },
      { totalValidity: 0, passedCount: 0 }
    );

    const validityScore = totalValidity / parsed.cases.length;
    const passRate = passedCount / parsed.cases.length;

    console.log(`Golden cases: ${parsed.cases.length}`);
    console.log(`Average validity: ${validityScore.toFixed(4)}`);
    console.log(`Pass rate: ${(passRate * 100).toFixed(2)}%`);

    if (validityScore < 0.98 || passRate < 0.9) {
      console.error(
        "Golden evaluation thresholds not met (validity >= 0.98 and pass rate >= 0.90 required)."
      );
      process.exit(1);
    }

    console.log("Golden evaluation thresholds met.");
  } catch (error) {
    console.error("Failed to run golden evaluations:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
