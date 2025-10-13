import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "ingest-paygw.ts");
const fixturesDir = path.join(__dirname, "fixtures");
const outputDir = path.join(repoRoot, "rules", "paygw");

const meta = {
  effectiveFrom: "2024-07-01",
  source: "ATO PAYG withholding tables (worked example extract)",
  url: "https://www.ato.gov.au/rates/tax-tables",
  digest: "fixture-digest",
};

const frequencyFiles = {
  weekly: path.join(fixturesDir, "2024-07-01_weekly.csv"),
  fortnightly: path.join(fixturesDir, "2024-07-01_fortnightly.csv"),
  monthly: path.join(fixturesDir, "2024-07-01_monthly.csv"),
};

const expectedSamples = {
  weekly: [
    { gross: 500, withheld: 84 },
    { gross: 1200, withheld: 344 },
    { gross: 2500, withheld: 947 },
  ],
  fortnightly: [
    { gross: 1500, withheld: 338 },
    { gross: 2500, withheld: 737 },
    { gross: 4500, withheld: 1671 },
  ],
  monthly: [
    { gross: 2000, withheld: 325 },
    { gross: 4000, withheld: 994 },
    { gross: 9000, withheld: 3285 },
  ],
};

function loadPack(frequency) {
  const filepath = path.join(outputDir, `${meta.effectiveFrom}_${frequency}.json`);
  if (!existsSync(filepath)) {
    throw new Error(`Missing pack output for ${frequency} at ${filepath}`);
  }
  const contents = readFileSync(filepath, "utf8");
  return JSON.parse(contents);
}

function evaluateWithholding(pack, gross) {
  const segment = pack.piecewise.find((piece) => {
    if (gross < piece.lower) {
      return false;
    }
    if (piece.upper === null || piece.upper === undefined) {
      return true;
    }
    return gross <= piece.upper;
  });

  if (!segment) {
    throw new Error(`No withholding segment found for ${gross}`);
  }

  const value = Math.round(gross * segment.slope + segment.intercept);
  return value;
}

test("ingest PAYGW tables into normalized packs", async (t) => {
  const args = [
    "exec",
    "tsx",
    scriptPath,
    "--effective-from",
    meta.effectiveFrom,
    "--source",
    meta.source,
    "--url",
    meta.url,
    "--digest",
    meta.digest,
    frequencyFiles.weekly,
    frequencyFiles.fortnightly,
    frequencyFiles.monthly,
  ];

  execFileSync("pnpm", args, { cwd: repoRoot, stdio: "inherit" });

  const cleanupTargets = [
    path.join(outputDir, `${meta.effectiveFrom}_weekly.json`),
    path.join(outputDir, `${meta.effectiveFrom}_fortnightly.json`),
    path.join(outputDir, `${meta.effectiveFrom}_monthly.json`),
  ];

  for (const target of cleanupTargets) {
    t.after(() => {
      if (existsSync(target)) {
        rmSync(target);
      }
    });
  }

  for (const [frequency, samples] of Object.entries(expectedSamples)) {
    const pack = loadPack(frequency);

    assert.equal(pack.meta.frequency, frequency);
    assert.equal(pack.meta.effectiveFrom, meta.effectiveFrom);
    assert.equal(pack.meta.source, meta.source);
    assert.equal(pack.thresholdRows.length, 7);
    assert.equal(pack.thresholdRows.length, pack.piecewise.length);

    for (const { gross, withheld } of samples) {
      const calculated = evaluateWithholding(pack, gross);
      assert.equal(
        calculated,
        withheld,
        `${frequency} gross ${gross} should withhold ${withheld}`
      );
    }
  }
});
