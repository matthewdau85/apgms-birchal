#!/usr/bin/env tsx
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getState, resetState, Suite, Hook, TestFn } from "./testing";

type TestCase = { name: string; fn: TestFn };

type RunResult = { passed: number; failed: number };

async function findTestFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (["test", "tests", "__tests__"].includes(entry.name)) {
        files.push(...(await collectTestsInDir(fullPath)));
      } else {
        files.push(...(await findTestFiles(fullPath)));
      }
    }
  }
  return files;
}

async function collectTestsInDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await collectTestsInDir(path.join(dir, entry.name))));
    } else if (/\.test\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

async function loadTests(testFiles: string[]) {
  resetState();
  for (const file of testFiles) {
    const url = pathToFileURL(file).href;
    await import(url);
  }
}

async function runSuite(
  suite: Suite,
  inheritedBefores: Hook[],
  inheritedAfters: Hook[],
): Promise<RunResult> {
  let passed = 0;
  let failed = 0;

  const beforeEachHooks: Hook[] = [...inheritedBefores, ...suite.beforeEach];
  const afterEachHooks: Hook[] = [...suite.afterEach, ...inheritedAfters];

  for (const child of suite.suites) {
    const childResult = await runSuite(child, beforeEachHooks, afterEachHooks);
    passed += childResult.passed;
    failed += childResult.failed;
  }

  for (const testCase of suite.tests as TestCase[]) {
    try {
      for (const hook of beforeEachHooks) {
        await hook();
      }
      await testCase.fn();
      for (const hook of afterEachHooks) {
        await hook();
      }
      console.log(`✓ ${suite.name}: ${testCase.name}`);
      passed += 1;
    } catch (error) {
      failed += 1;
      console.error(`✗ ${suite.name}: ${testCase.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  for (const hook of suite.afterAll) {
    try {
      await hook();
    } catch (error) {
      console.error(`afterAll hook failed in suite ${suite.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  return { passed, failed };
}

async function main() {
  const cwd = process.cwd();
  const tests = await findTestFiles(cwd);
  if (tests.length === 0) {
    console.warn("No tests found");
    return;
  }

  await loadTests(tests);

  const state = getState();
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of state.suites) {
    const result = await runSuite(suite, suite.beforeEach, suite.afterEach);
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  console.log(`\nTest run complete: ${totalPassed} passed, ${totalFailed} failed`);
  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
