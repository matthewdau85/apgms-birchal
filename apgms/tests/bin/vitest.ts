import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface Hook {
  fn: () => void | Promise<void>;
}

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
  suitePath: string[];
  filePath: string;
  beforeEach: Hook[];
  afterEach: Hook[];
}

interface SuiteContext {
  name: string;
  beforeEach: Hook[];
  afterEach: Hook[];
}

interface SnapshotStore {
  data: Record<string, unknown>;
  dirty: boolean;
}

class VitestRunner {
  private currentFile: string | null = null;
  private suites: SuiteContext[] = [];
  private tests: TestCase[] = [];
  private currentTest: TestCase | null = null;
  private snapshots: SnapshotStore | null = null;
  private testResults: { name: string; status: "pass" | "fail"; category: string }[] = [];

  describe(name: string, fn: () => void | Promise<void>) {
    const context: SuiteContext = { name, beforeEach: [], afterEach: [] };
    this.suites.push(context);
    try {
      fn();
    } finally {
      this.suites.pop();
    }
  }

  beforeEach(fn: () => void | Promise<void>) {
    const suite = this.suites.at(-1);
    if (!suite) throw new Error("beforeEach must be used inside describe");
    suite.beforeEach.push({ fn });
  }

  afterEach(fn: () => void | Promise<void>) {
    const suite = this.suites.at(-1);
    if (!suite) throw new Error("afterEach must be used inside describe");
    suite.afterEach.push({ fn });
  }

  test(name: string, fn: () => void | Promise<void>) {
    if (!this.currentFile) throw new Error("test() invoked outside of file context");
    const suites = [...this.suites];
    const beforeEach = suites.flatMap((suite) => suite.beforeEach);
    const afterEach = suites.flatMap((suite) => suite.afterEach);
    this.tests.push({
      name,
      fn,
      suitePath: suites.map((suite) => suite.name),
      filePath: this.currentFile,
      beforeEach,
      afterEach,
    });
  }

  expect(actual: unknown) {
    const ctx = this.currentTest;
    if (!ctx) {
      throw new Error("expect() must be called during an active test");
    }
    const compare = (expected: unknown, comparator: (a: unknown, b: unknown) => boolean, message: string) => {
      if (!comparator(actual, expected)) {
        throw new Error(`${message}\nExpected: ${JSON.stringify(expected, null, 2)}\nReceived: ${JSON.stringify(actual, null, 2)}`);
      }
    };

    const toMatchSnapshot = () => {
      if (!this.snapshots) throw new Error("Snapshot store not initialised");
      const key = `${ctx.suitePath.join(" ")} ${ctx.name}`.trim();
      const serialised = JSON.stringify(actual, null, 2);
      if (Object.prototype.hasOwnProperty.call(this.snapshots.data, key)) {
        const expected = this.snapshots.data[key];
        if (expected !== serialised) {
          throw new Error(`Snapshot mismatch for ${key}`);
        }
      } else {
        this.snapshots.data[key] = serialised;
        this.snapshots.dirty = true;
      }
    };

    return {
      toBe: (value: unknown) => compare(value, (a, b) => a === b, "toBe assertion failed"),
      toEqual: (value: unknown) => compare(value, (a, b) => JSON.stringify(a) === JSON.stringify(b), "toEqual assertion failed"),
      toContain: (value: unknown) => {
        if (typeof actual === "string") {
          if (!actual.includes(value as string)) {
            throw new Error(`Expected string to contain ${value}`);
          }
          return;
        }
        if (Array.isArray(actual)) {
          if (!actual.includes(value)) {
            throw new Error(`Expected array to contain ${value}`);
          }
          return;
        }
        throw new Error("toContain requires string or array");
      },
      toHaveLength: (length: number) => {
        if (!actual || typeof (actual as any).length !== "number") {
          throw new Error("toHaveLength requires a length property");
        }
        const actualLength = (actual as any).length;
        if (actualLength !== length) {
          throw new Error(
            `toHaveLength assertion failed\nExpected length: ${length}\nReceived length: ${actualLength}\nReceived value: ${JSON.stringify(actual, null, 2)}`,
          );
        }
      },
      toBeGreaterThanOrEqual: (value: number) => {
        if (typeof actual !== "number") {
          throw new Error("toBeGreaterThanOrEqual requires number");
        }
        if ((actual as number) < value) {
          throw new Error(`Expected ${actual} to be >= ${value}`);
        }
      },
      toThrow: (matcher?: RegExp | string) => {
        if (typeof actual !== "function") {
          throw new Error("toThrow requires a function");
        }
        let thrown: unknown;
        try {
          (actual as () => unknown)();
        } catch (error) {
          thrown = error instanceof Error ? error.message : String(error);
        }
        if (!thrown) {
          throw new Error("Expected function to throw");
        }
        if (matcher) {
          if (matcher instanceof RegExp) {
            if (!matcher.test(thrown)) {
              throw new Error(`Expected error to match ${matcher}, received ${thrown}`);
            }
          } else if (!String(thrown).includes(matcher)) {
            throw new Error(`Expected error to include ${matcher}, received ${thrown}`);
          }
        }
      },
      toMatchSnapshot,
    };
  }

  async runFile(filePath: string) {
    this.currentFile = filePath;
    this.tests = [];
    this.suites = [];
    this.snapshots = this.loadSnapshots(filePath);
    await import(pathToFileURL(filePath).href);
    const category = this.inferCategory(filePath);
    await this.executeTests(category);
    this.saveSnapshots(filePath);
    this.currentFile = null;
    this.snapshots = null;
  }

  private async executeTests(category: string) {
    for (const test of this.tests) {
      this.currentTest = test;
      try {
        for (const hook of test.beforeEach) {
          await hook.fn();
        }
        await test.fn();
        for (const hook of [...test.afterEach].reverse()) {
          await hook.fn();
        }
        const name = `${test.suitePath.join(" ")} ${test.name}`.trim();
        this.report.success(name);
        this.testResults.push({ name, status: "pass", category });
      } catch (error) {
        const name = `${test.suitePath.join(" ")} ${test.name}`.trim();
        this.report.failure(name, error as Error);
        this.testResults.push({ name, status: "fail", category });
      }
    }
    this.currentTest = null;
  }

  private inferCategory(filePath: string): string {
    const segments = filePath.split(path.sep);
    if (segments.includes("red-team")) return "red-team";
    if (segments.includes("integration")) return "golden";
    return "unit";
  }

  private loadSnapshots(filePath: string): SnapshotStore {
    const snapshotDir = path.join(path.dirname(filePath), "__snapshots__");
    const snapshotFile = path.join(snapshotDir, `${path.basename(filePath)}.snap.json`);
    if (fs.existsSync(snapshotFile)) {
      const raw = fs.readFileSync(snapshotFile, "utf8");
      return { data: JSON.parse(raw), dirty: false };
    }
    return { data: {}, dirty: false };
  }

  private saveSnapshots(filePath: string) {
    if (!this.snapshots || !this.snapshots.dirty) return;
    const snapshotDir = path.join(path.dirname(filePath), "__snapshots__");
    const snapshotFile = path.join(snapshotDir, `${path.basename(filePath)}.snap.json`);
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(snapshotFile, JSON.stringify(this.snapshots.data, null, 2));
  }

  private report = {
    successes: [] as string[],
    failures: [] as { name: string; error: string }[],
    success: (name: string) => {
      this.report.successes.push(name);
      console.log(`✓ ${name}`);
    },
    failure: (name: string, error: Error) => {
      this.report.failures.push({ name, error: error.stack ?? String(error) });
      console.error(`✗ ${name}`);
      console.error(error.stack ?? String(error));
    },
  };

  getResults() {
    return { ...this.report, testResults: this.testResults };
  }
}

function collectTestFiles(root: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
    } else if (/\.(spec|test)\.ts$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const runner = new VitestRunner();
  (globalThis as any).__vitestRunner = runner;

  const testsRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const files = collectTestFiles(testsRoot);

  for (const file of files) {
    await runner.runFile(file);
  }

  const results = runner.getResults();
  const reportsDir = path.resolve(testsRoot, "../reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const categories = new Map<string, { successes: number; failures: number }>();
  for (const outcome of results.testResults) {
    const stats = categories.get(outcome.category) ?? { successes: 0, failures: 0 };
    if (outcome.status === "pass") {
      stats.successes += 1;
    } else {
      stats.failures += 1;
    }
    categories.set(outcome.category, stats);
  }

  const guardrails = ["unit", "golden", "red-team"];
  let totalFailures = 0;
  for (const guardrail of guardrails) {
    const stats = categories.get(guardrail) ?? { successes: 0, failures: 0 };
    totalFailures += stats.failures;
    const status = stats.failures === 0 ? "pass" : "fail";
    const report = {
      name: guardrail,
      status,
      details: stats.failures ? `${stats.failures} failing tests` : undefined,
      meta: stats,
    };
    fs.writeFileSync(path.join(reportsDir, `${guardrail}.json`), JSON.stringify(report, null, 2));
  }

  if (totalFailures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
