import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const cmd = spawnSync(
  "pnpm",
  [
    "exec",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "--experimental-test-coverage",
    "index.ts"
  ],
  {
    cwd: projectRoot,
    env: process.env,
    encoding: "utf-8",
  }
);

if (cmd.stdout) {
  process.stdout.write(cmd.stdout);
}
if (cmd.stderr) {
  process.stderr.write(cmd.stderr);
}

if (cmd.status !== 0) {
  process.exit(cmd.status ?? 1);
}

const coverageLine = cmd.stdout
  .split(/\r?\n/)
  .find((line) => line.includes("all files"));

if (!coverageLine) {
  console.error("Unable to determine coverage totals");
  process.exit(1);
}

const parts = coverageLine.split("|").map((part) => part.trim()).filter(Boolean);
const linesPercent = Number(parts[1]);

if (Number.isNaN(linesPercent)) {
  console.error(`Failed to parse coverage from line: ${coverageLine}`);
  process.exit(1);
}

if (linesPercent < 80) {
  console.error(`Coverage ${linesPercent}% is below required threshold of 80%`);
  process.exit(1);
}
