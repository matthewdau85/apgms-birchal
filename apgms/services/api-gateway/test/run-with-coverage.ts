import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const coverageDir = path.join(serviceRoot, "coverage");
const v8Dir = path.join(coverageDir, "v8");
const loaderPath = path.resolve(serviceRoot, "../../scripts/ts-loader.mjs");

await rm(coverageDir, { recursive: true, force: true });
await mkdir(v8Dir, { recursive: true });

const testFiles = await collectTestFiles(path.join(serviceRoot, "test"));

if (testFiles.length === 0) {
  console.error("No test files found under services/api-gateway/test");
  process.exit(1);
}

const testArgs = [
  "--test",
  "--experimental-test-coverage",
  "--loader",
  loaderPath,
  ...testFiles.map((file) => path.relative(serviceRoot, file)),
];

const child = spawn(process.execPath, testArgs, {
  cwd: serviceRoot,
  stdio: "inherit",
  env: { ...process.env, NODE_V8_COVERAGE: v8Dir },
});

const exitCode: number | null = await new Promise((resolve) => {
  child.on("exit", (code) => resolve(code));
});

if (exitCode !== 0) {
  process.exit(exitCode ?? 1);
}

await ensureCoverageThresholds(v8Dir, serviceRoot, coverageDir);

async function ensureCoverageThresholds(v8Directory: string, projectRoot: string, outputDir: string) {
  const coverageByFile = new Map<
    string,
    {
      lineRanges: Array<{ start: number; end: number; count: number }>;
      branchRanges: Map<string, number>;
    }
  >();

  const files = await readdir(v8Directory);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(path.join(v8Directory, file), "utf8");
    const json = JSON.parse(raw) as {
      result: Array<{
        url: string;
        functions: Array<{
          functionName: string;
          isBlockCoverage: boolean;
          ranges: Array<{ startOffset: number; endOffset: number; count: number }>;
        }>;
      }>;
    };
    for (const entry of json.result) {
      if (!entry.url.startsWith("file:")) {
        continue;
      }
      const filePath = fileURLToPath(entry.url);
      if (!filePath.includes(`${path.sep}services${path.sep}api-gateway${path.sep}src${path.sep}`)) {
        continue;
      }
      let fileCoverage = coverageByFile.get(filePath);
      if (!fileCoverage) {
        fileCoverage = { lineRanges: [], branchRanges: new Map() };
        coverageByFile.set(filePath, fileCoverage);
      }
      for (const fn of entry.functions) {
        for (const range of fn.ranges) {
          fileCoverage.lineRanges.push({
            start: range.startOffset,
            end: range.endOffset,
            count: range.count ?? 0,
          });
          if (fn.isBlockCoverage) {
            const key = `${range.startOffset}:${range.endOffset}`;
            const existing = fileCoverage.branchRanges.get(key) ?? 0;
            fileCoverage.branchRanges.set(key, Math.max(existing, range.count ?? 0));
          }
        }
      }
    }
  }

  const summary: Record<
    string,
    {
      lines: { covered: number; total: number; pct: number; uncovered: number[] };
      branches: { covered: number; total: number; pct: number };
    }
  > = {};

  let totalLines = 0;
  let coveredLines = 0;
  let totalBranches = 0;
  let coveredBranches = 0;

  for (const [filePath, coverage] of coverageByFile) {
    const metrics = await computeFileCoverage(filePath, coverage.lineRanges, coverage.branchRanges);
    const relativePath = path.relative(projectRoot, filePath);
    summary[relativePath] = metrics;
    totalLines += metrics.lines.total;
    coveredLines += metrics.lines.covered;
    totalBranches += metrics.branches.total;
    coveredBranches += metrics.branches.covered;
  }

  const totalLinePct = totalLines === 0 ? 100 : (coveredLines / totalLines) * 100;
  const totalBranchPct = totalBranches === 0 ? 100 : (coveredBranches / totalBranches) * 100;

  await writeFile(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        totals: {
          lines: { covered: coveredLines, total: totalLines, pct: totalLinePct },
          branches: { covered: coveredBranches, total: totalBranches, pct: totalBranchPct },
        },
        files: summary,
      },
      null,
      2,
    ),
    "utf8",
  );

  const failingFiles = Object.entries(summary).filter(
    ([, metrics]) => metrics.lines.pct < 80 || metrics.branches.pct < 80,
  );

  if (totalLinePct < 80 || totalBranchPct < 80 || failingFiles.length > 0) {
    console.error("❌ Coverage thresholds not met.");
    for (const [file, metrics] of failingFiles) {
      console.error(
        ` - ${file}: lines ${metrics.lines.pct.toFixed(2)}%, branches ${metrics.branches.pct.toFixed(2)}% (min 80%)`,
      );
    }
    console.error(
      `Totals: lines ${totalLinePct.toFixed(2)}% (${coveredLines}/${totalLines}), branches ${totalBranchPct.toFixed(2)}% (${coveredBranches}/${totalBranches}).`,
    );
    process.exit(1);
  }

  console.log(
    `✅ Coverage thresholds satisfied. Lines ${totalLinePct.toFixed(2)}%, Branches ${totalBranchPct.toFixed(2)}%.`,
  );
}

async function collectTestFiles(dir: string): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      results.push(...(await collectTestFiles(fullPath)));
    } else if (info.isFile() && entry.endsWith(".test.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function computeFileCoverage(
  filePath: string,
  ranges: Array<{ start: number; end: number; count: number }>,
  branchRanges: Map<string, number>,
) {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  const lineInfo: Array<{ start: number; end: number; text: string }> = [];
  let offset = 0;
  for (const text of lines) {
    const start = offset;
    const end = start + text.length;
    lineInfo.push({ start, end, text });
    offset = end + 1;
  }

  const coverageState = lineInfo.map((info) => ({
    hasCode: info.text.trim().length > 0,
    covered: false,
  }));

  const offsets = lineInfo.map((info) => info.end);

  function offsetToLine(offset: number) {
    let low = 0;
    let high = offsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (offsets[mid] > offset) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return Math.max(0, Math.min(offsets.length - 1, low));
  }

  for (const range of ranges) {
    const startIndex = offsetToLine(range.start);
    const endIndex = offsetToLine(Math.max(range.end - 1, range.start));
    for (let i = startIndex; i <= endIndex; i++) {
      if (coverageState[i]) {
        coverageState[i].covered ||= range.count > 0;
      }
    }
  }

  const uncoveredLines: number[] = [];
  let covered = 0;
  let total = 0;
  coverageState.forEach((state, index) => {
    if (!state.hasCode) {
      return;
    }
    total += 1;
    if (state.covered) {
      covered += 1;
    } else {
      uncoveredLines.push(index + 1);
    }
  });

  let branchTotal = 0;
  let branchCovered = 0;
  for (const [, count] of branchRanges) {
    branchTotal += 1;
    if (count > 0) {
      branchCovered += 1;
    }
  }

  return {
    lines: {
      covered,
      total,
      pct: total === 0 ? 100 : (covered / total) * 100,
      uncovered: uncoveredLines,
    },
    branches: {
      covered: branchCovered,
      total: branchTotal,
      pct: branchTotal === 0 ? 100 : (branchCovered / branchTotal) * 100,
    },
  };
}
