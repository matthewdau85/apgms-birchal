import fs from "node:fs";
import path from "node:path";

const baseDir = path.resolve(process.cwd(), "eval/redteam");
const artifactDir = path.resolve(process.cwd(), "artifacts/eval");

async function main() {
  const files = await fs.promises.readdir(baseDir);
  const cases = [] as Array<{ id: string; status: "pass" | "fail"; reason?: string }>;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.promises.readFile(path.join(baseDir, file), "utf8");
    const data = JSON.parse(raw);
    if (!data.expected_behavior) {
      cases.push({ id: data.id ?? file, status: "fail", reason: "missing expected_behavior" });
    } else {
      cases.push({ id: data.id ?? file, status: "pass" });
    }
  }

  const failures = cases.filter((c) => c.status === "fail");
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: cases.length,
      passed: cases.length - failures.length,
      failed: failures.length,
    },
    cases,
  };

  await fs.promises.mkdir(artifactDir, { recursive: true });
  const reportPath = path.join(artifactDir, "redteam-report.json");
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (failures.length > 0) {
    console.error(`Redteam checks failed for ${failures.length} cases`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
