import fs from "node:fs/promises";
import path from "node:path";

export interface ReporterTestResult {
  name: string;
  duration: number;
  status: "passed" | "failed";
  error?: Error;
}

export interface ReporterFileResult {
  filePath: string;
  tests: ReporterTestResult[];
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/'/g, "&apos;");
}

function escapeCdata(value: string): string {
  return value.replace(/]]>/g, "]]&gt;");
}

export async function writeJUnitReport(results: ReporterFileResult[], outputFile: string) {
  const totalTests = results.reduce((sum, file) => sum + file.tests.length, 0);
  const totalFailures = results.reduce(
    (sum, file) => sum + file.tests.filter((test) => test.status === "failed").length,
    0,
  );
  const totalTimeSeconds = (
    results.reduce((sum, file) => sum + file.tests.reduce((acc, test) => acc + test.duration, 0), 0) /
    1000
  ).toFixed(3);

  const cases: string[] = [];

  for (const file of results) {
    const classname = path.relative(process.cwd(), file.filePath).split(path.sep).join("/");
    for (const test of file.tests) {
      const timeSeconds = (test.duration / 1000).toFixed(6);
      const failureBlock =
        test.status === "failed" && test.error
          ? `<failure message="${escapeAttribute(test.error.message)}"><![CDATA[${escapeCdata(
              test.error.stack ?? test.error.message,
            )}]]></failure>`
          : "";
      cases.push(
        `<testcase classname="${escapeAttribute(classname)}" name="${escapeAttribute(test.name)}" time="${timeSeconds}">${failureBlock}</testcase>`,
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="vitest" tests="${totalTests}" failures="${totalFailures}" time="${totalTimeSeconds}">\n${cases.join(
    "\n",
  )}\n</testsuite>\n`;

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, xml, "utf8");
}
