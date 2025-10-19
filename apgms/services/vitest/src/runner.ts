import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  getRootSuite,
  resetRegistry,
  type Suite,
  type TestCase,
} from "./internal";
import { writeJUnitReport } from "./reporters/junit";

interface CliOptions {
  reporter?: string;
  outputFile?: string;
  filters: string[];
}

interface TestResult {
  name: string;
  duration: number;
  status: "passed" | "failed";
  error?: Error;
}

interface FileResult {
  filePath: string;
  tests: TestResult[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { filters: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "run") {
      continue;
    }

    if (arg.startsWith("--reporter=")) {
      options.reporter = arg.split("=")[1];
      continue;
    }

    if (arg === "--reporter" && argv[i + 1]) {
      options.reporter = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--outputFile=")) {
      options.outputFile = arg.split("=")[1];
      continue;
    }

    if (arg === "--outputFile" && argv[i + 1]) {
      options.outputFile = argv[i + 1];
      i += 1;
      continue;
    }

    options.filters.push(arg);
  }

  return options;
}

async function collectTestFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const skip = new Set(["node_modules", "dist", "coverage", ".git", "artifacts"]);

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        if (entry.name !== ".") {
          continue;
        }
      }
      if (skip.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  files.sort();
  return files;
}

function collectBeforeEach(suite: Suite) {
  const hooks = [] as Array<() => Promise<void>>;
  let current: Suite | null = suite;
  while (current) {
    for (let i = current.beforeEach.length - 1; i >= 0; i -= 1) {
      const hook = current.beforeEach[i];
      hooks.unshift(async () => {
        await hook();
      });
    }
    current = current.parent;
  }
  return hooks;
}

function collectAfterEach(suite: Suite) {
  const hooks = [] as Array<() => Promise<void>>;
  let current: Suite | null = suite;
  while (current) {
    for (const hook of current.afterEach) {
      hooks.push(async () => {
        await hook();
      });
    }
    current = current.parent;
  }
  return hooks;
}

async function runSuite(suite: Suite, ancestors: string[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const test of suite.tests) {
    results.push(await runTest(test, suite, ancestors));
  }

  for (const child of suite.suites) {
    results.push(...(await runSuite(child, [...ancestors, child.name])));
  }

  return results;
}

async function runTest(testCase: TestCase, suite: Suite, ancestors: string[]): Promise<TestResult> {
  const name = [...ancestors, testCase.name].join(" » ");
  const beforeHooks = collectBeforeEach(suite);
  const afterHooks = collectAfterEach(suite);
  const start = performance.now();
  let error: Error | undefined;

  try {
    for (const hook of beforeHooks) {
      try {
        await hook();
      } catch (hookErr) {
        error = hookErr instanceof Error ? hookErr : new Error(String(hookErr));
        throw error;
      }
    }

    await testCase.handler();
  } catch (err) {
    if (err instanceof Error) {
      error = err;
    } else if (!error) {
      error = new Error(String(err));
    }
  } finally {
    for (const hook of afterHooks) {
      try {
        await hook();
      } catch (hookErr) {
        if (!error) {
          error = hookErr instanceof Error ? hookErr : new Error(String(hookErr));
        }
      }
    }
  }

  const duration = performance.now() - start;
  return {
    name,
    duration,
    status: error ? "failed" : "passed",
    error,
  };
}

async function runFile(filePath: string): Promise<FileResult> {
  resetRegistry();
  const moduleUrl = pathToFileURL(filePath).href;
  await import(moduleUrl);
  const suite = getRootSuite();
  const tests = await runSuite(suite, []);
  return { filePath, tests };
}

function filterFiles(files: string[], filters: string[]) {
  if (filters.length === 0) {
    return files;
  }
  return files.filter((file) => filters.some((fragment) => file.includes(fragment)));
}

function formatDuration(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../..");
  const allFiles = await collectTestFiles(repoRoot);
  const files = filterFiles(allFiles, options.filters);

  if (files.length === 0) {
    console.log("No test files found.");
    return;
  }

  const results: FileResult[] = [];
  let totalDuration = 0;
  let totalFailures = 0;

  for (const file of files) {
    const fileStart = performance.now();
    const fileResult = await runFile(file);
    totalDuration += performance.now() - fileStart;
    totalFailures += fileResult.tests.filter((test) => test.status === "failed").length;
    results.push(fileResult);
  }

  for (const fileResult of results) {
    const relative = path.relative(process.cwd(), fileResult.filePath);
    console.log(`\n${relative}`);
    for (const test of fileResult.tests) {
      const icon = test.status === "passed" ? "✓" : "✗";
      console.log(`  ${icon} ${test.name} (${formatDuration(test.duration)})`);
      if (test.error) {
        console.error(`    ${test.error.stack ?? test.error.message}`);
      }
    }
  }

  const totalTests = results.reduce((sum, file) => sum + file.tests.length, 0);
  const passed = totalTests - totalFailures;
  console.log(`\n${passed}/${totalTests} tests passed in ${formatDuration(totalDuration)}`);

  if (options.reporter === "junit" && options.outputFile) {
    await writeJUnitReport(results, options.outputFile);
    console.log(`JUnit report written to ${options.outputFile}`);
  }

  if (totalFailures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
