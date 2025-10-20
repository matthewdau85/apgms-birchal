#!/usr/bin/env node
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { createRuntime, discoverTests, loadCompiledTest } from "../src/runtime.mjs";

const [, , command = "run"] = process.argv;

if (command !== "run") {
  console.error(`Unsupported command: ${command}`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vitestEntry = path.resolve(__dirname, "../src/index.js");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, parent, ...rest) {
  if (request === "vitest") {
    return vitestEntry;
  }
  return originalResolve.call(this, request, parent, ...rest);
};

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test");

const runtime = createRuntime();
// Expose runtime so test modules can register suites/tests.
globalThis.__vitestLiteRuntime = runtime;

const testFiles = discoverTests(testDir);

if (testFiles.length === 0) {
  console.log("No test files found.\n0 passed, 0 failed");
  process.exit(0);
}

try {
  const compiled = await runtime.compileTests(projectRoot, testFiles, vitestEntry);
  for (const file of compiled) {
    await loadCompiledTest(file);
  }
  const success = await runtime.runTests();
  if (!success) {
    process.exit(1);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
