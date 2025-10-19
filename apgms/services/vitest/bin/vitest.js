#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runnerPath = path.resolve(__dirname, "../src/runner.ts");

const args = process.argv.slice(2);

const child = spawn(process.execPath, ["--import", "tsx", runnerPath, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
