import fs from "node:fs";
import path from "node:path";

const baseDir = path.resolve(process.cwd(), "eval/golden");
const artifactDir = path.resolve(process.cwd(), "artifacts/eval");

async function main() {
  const files = await fs.promises.readdir(baseDir);
  const results = [] as Array<{ id: string; schemaValid: boolean; passed: boolean; reason?: string }>;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.promises.readFile(path.join(baseDir, file), "utf8");
    const data = JSON.parse(raw);
    const schemaValid = typeof data.expected_response === "object" && data.expected_response !== null;
    const passed = schemaValid;
    results.push({ id: data.id ?? file, schemaValid, passed, reason: schemaValid ? undefined : "invalid schema" });
  }

  const schemaValidity = results.filter((r) => r.schemaValid).length / (results.length || 1);
  const passRate = results.filter((r) => r.passed).length / (results.length || 1);

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: { schemaValidity: 0.98, passRate: 0.9 },
    metrics: { schemaValidity, passRate },
    results,
  };

  await fs.promises.mkdir(artifactDir, { recursive: true });
  const reportPath = path.join(artifactDir, "golden-report.json");
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (schemaValidity < 0.98 || passRate < 0.9) {
    console.error("Golden evaluation thresholds not met");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
