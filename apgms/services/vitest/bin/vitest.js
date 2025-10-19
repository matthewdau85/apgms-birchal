#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runner = path.join(__dirname, "..", "src", "runner.js");

const args = process.argv.slice(2);
const patterns = args.length > 0 && args[0] === "run" ? args.slice(1) : args;
const spawnArgs = [tsxCli, runner, ...patterns];

const child = spawn(process.execPath, spawnArgs, { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
