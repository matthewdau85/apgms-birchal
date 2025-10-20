#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { register, tsImport } from "tsx/esm/api";

import { resetRuntime, runRegisteredTests } from "../runtime.js";

register();

function findTestFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = resolve(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (["node_modules", "dist"].includes(entry)) {
        continue;
      }
      files.push(...findTestFiles(fullPath));
    } else if (/\.test\.(t|j)sx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const cwd = process.cwd();
  const testFiles = findTestFiles(cwd).sort();
  if (testFiles.length === 0) {
    console.log("No tests found.");
    return;
  }
  resetRuntime();
  for (const file of testFiles) {
    await tsImport(pathToFileURL(file).href, import.meta.url);
  }
  await runRegisteredTests();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
