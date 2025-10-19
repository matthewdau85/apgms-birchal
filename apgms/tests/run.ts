import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getRootSuite, type Suite, type SuiteEntry } from "./support/vitest";

type TestStats = {
  total: number;
  passed: number;
  failed: number;
};

const specs: string[] = [];

async function main(): Promise<void> {
  await loadSpecs();
  const setupPath = path.resolve("tests/setup.ts");
  await import(pathToFileURL(setupPath).href);

  for (const spec of specs) {
    await import(pathToFileURL(spec).href);
  }

  const stats: TestStats = { total: 0, passed: 0, failed: 0 };
  await runSuite(getRootSuite(), [], stats);

  console.log(`\nTests: ${stats.passed}/${stats.total} passed, ${stats.failed} failed`);
  if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

async function loadSpecs(): Promise<void> {
  const rootDir = path.resolve("tests");
  await walk(rootDir);
}

async function walk(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath);
    } else if (entry.name.endsWith(".spec.ts")) {
      specs.push(path.resolve(entryPath));
    }
  }
}

async function runSuite(suite: Suite, ancestors: Suite[], stats: TestStats): Promise<void> {
  const nextAncestors = [...ancestors, suite];
  for (const entry of suite.entries) {
    if (entry.type === "suite") {
      await runSuite(entry.suite, nextAncestors, stats);
    } else {
      await runTest(entry, nextAncestors, stats);
    }
  }
}

async function runTest(entry: SuiteEntry & { type: "test" }, ancestors: Suite[], stats: TestStats): Promise<void> {
  const hooks = ancestors.flatMap((suite) => suite.beforeEachHooks);
  const afterHooks = ancestors.flatMap((suite) => suite.afterEachHooks).reverse();

  stats.total += 1;
  let failed = false;
  let passedIncremented = false;
  try {
    for (const hook of hooks) {
      await hook();
    }
    await entry.test.fn();
    stats.passed += 1;
    passedIncremented = true;
    console.log(`✓ ${buildName([...ancestors.slice(1), entry.test.name])}`);
  } catch (err) {
    failed = true;
    stats.failed += 1;
    console.error(`✗ ${buildName([...ancestors.slice(1), entry.test.name])}`);
    console.error(err);
  } finally {
    for (const hook of afterHooks) {
      try {
        await hook();
      } catch (err) {
        failed = true;
        stats.failed += 1;
        console.error(`✗ afterEach for ${buildName([...ancestors.slice(1), entry.test.name])}`);
        console.error(err);
      }
    }
    if (failed && passedIncremented) {
      stats.passed -= 1;
    }
  }
}

function buildName(parts: (Suite | string)[]): string {
  return parts
    .map((part) => (typeof part === "string" ? part : part.name))
    .filter(Boolean)
    .join(" > ");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
