#!/usr/bin/env node
import "tsx/esm";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";
import {
  describe as describeFn,
  expect as expectFn,
  getEntries,
  it as itFn,
  resetState,
  runEntries,
  test as testFn,
} from "../dist/index.js";

globalThis.describe = describeFn;
globalThis.it = itFn;
globalThis.test = testFn;
globalThis.expect = expectFn;

const args = process.argv.slice(2);
const command = args[0];

if (command !== "run") {
  console.error("Unknown command. Usage: vitest run");
  process.exit(1);
}

const rootDir = process.cwd();
const testDir = args[1] ? resolve(rootDir, args[1]) : resolve(rootDir, "test");

async function findTestFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const entryPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await findTestFiles(entryPath));
      } else if (/\.(test|spec)\.[cm]?tsx?$/.test(entry.name)) {
        files.push(entryPath);
      }
    }
    return files;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

const files = await findTestFiles(testDir);

if (files.length === 0) {
  console.log("No tests found.");
  process.exit(0);
}

let totalPassed = 0;
let totalFailed = 0;

for (const file of files) {
  resetState();
  const relativePath = relative(rootDir, file);
  console.log(`\n${relativePath}`);
  try {
    await import(pathToFileURL(file).href);
  } catch (error) {
    console.error(`Failed to load ${relativePath}`);
    console.error(error);
    totalFailed += 1;
    continue;
  }
  const result = await runEntries(getEntries());
  totalPassed += result.passed;
  totalFailed += result.failed;
}

if (totalFailed > 0) {
  console.log(`\n${totalFailed} test${totalFailed === 1 ? "" : "s"} failed`);
  process.exit(1);
}

console.log(`\n${totalPassed} test${totalPassed === 1 ? "" : "s"} passed`);
