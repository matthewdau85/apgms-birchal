import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const createMatcher = () => {
  const anyMatcher = (ctor) => ({ __vitestAny: true, ctor });

  const isAnyMatcher = (value) => typeof value === "object" && value !== null && value.__vitestAny === true;

  const matchesAny = (actual, matcher) => {
    if (typeof matcher.ctor !== "function") {
      return true;
    }
    if (actual instanceof matcher.ctor) {
      return true;
    }
    const typeName = matcher.ctor.name.toLowerCase();
    if (["string", "number", "boolean"].includes(typeName)) {
      return typeof actual === typeName;
    }
    return false;
  };

  const deepEqual = (actual, expected) => {
    if (isAnyMatcher(expected)) {
      return matchesAny(actual, expected);
    }
    if (Array.isArray(actual) && Array.isArray(expected)) {
      if (actual.length !== expected.length) return false;
      return actual.every((value, index) => deepEqual(value, expected[index]));
    }
    if (actual && typeof actual === "object" && expected && typeof expected === "object") {
      const actualKeys = Object.keys(actual);
      const expectedKeys = Object.keys(expected);
      if (actualKeys.length !== expectedKeys.length) return false;
      return expectedKeys.every((key) => deepEqual(actual[key], expected[key]));
    }
    return Object.is(actual, expected);
  };

  return { anyMatcher, deepEqual };
};

export const createRuntime = () => {
  const rootTests = [];
  const suiteStack = [];
  const { anyMatcher, deepEqual } = createMatcher();

  const recordTest = (name, fn) => {
    const parts = [...suiteStack.map((s) => s.name), name].filter(Boolean);
    rootTests.push({ name: parts.join(" > "), fn });
  };

  const callSafely = async (fn) => {
    try {
      return await fn();
    } catch (error) {
      throw error;
    }
  };

  const expectImpl = (received) => {
    const assert = (condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    };

    const toThrowCore = (matcher) => {
      if (typeof received !== "function") {
        throw new Error("toThrow matcher requires a function");
      }
      let threw = false;
      try {
        received();
      } catch (err) {
        threw = true;
        if (matcher instanceof RegExp) {
          assert(matcher.test(String(err)), `Expected error to match ${matcher}, got ${err}`);
        } else if (typeof matcher === "string") {
          assert(String(err).includes(matcher), `Expected error to include ${matcher}, got ${err}`);
        }
      }
      assert(threw, "Expected function to throw");
    };

    return {
      toBe: (expected) => {
        assert(Object.is(received, expected), `Expected ${received} to be ${expected}`);
      },
      toEqual: (expected) => {
        assert(deepEqual(received, expected), `Expected ${JSON.stringify(received)} to equal ${JSON.stringify(expected)}`);
      },
      toThrow: (matcher) => {
        toThrowCore(matcher);
      },
      toThrowError: (matcher) => {
        toThrowCore(matcher);
      },
      toBeGreaterThanOrEqual: (expected) => {
        assert(typeof received === "number" && received >= expected, `Expected ${received} to be >= ${expected}`);
      },
    };
  };

  const expect = Object.assign(expectImpl, {
    any: (ctor) => anyMatcher(ctor),
  });

  const vi = {
    fn: (impl = () => undefined) => {
      const mockFn = (...args) => {
        mockFn.mock.calls.push(args);
        return impl(...args);
      };
      mockFn.mock = { calls: [] };
      return mockFn;
    },
  };

  const runTests = async () => {
    let passed = 0;
    let failed = 0;
    for (const test of rootTests) {
      try {
        await callSafely(test.fn);
        console.log(`\x1b[32m✓\x1b[0m ${test.name}`);
        passed += 1;
      } catch (error) {
        console.error(`\x1b[31m✗ ${test.name}\x1b[0m`);
        console.error(error);
        failed += 1;
      }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    return failed === 0;
  };

  const rewriteVitestImports = (filePath, vitestEntry) => {
    let targetPath = filePath;
    if (!fs.existsSync(targetPath) && targetPath.endsWith(".js")) {
      const alt = targetPath.replace(/\.js$/, ".mjs");
      if (fs.existsSync(alt)) {
        targetPath = alt;
      }
    }
    if (!fs.existsSync(targetPath)) {
      return targetPath;
    }
    const source = fs.readFileSync(targetPath, "utf8");
    const vitestUrl = pathToFileURL(vitestEntry).href;
    const updated = source
      .replace(/from\s+["']vitest["']/g, `from "${vitestUrl}"`)
      .replace(/require\(["']vitest["']\)/g, `require("${vitestEntry}")`);
    fs.writeFileSync(targetPath, updated, "utf8");
    return targetPath;
  };

  const compileTests = (projectRoot, files, vitestEntry) => {
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json");
    if (!configPath) {
      throw new Error("tsconfig.json not found");
    }
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vitest-lite-"));
    const compilerOptions = {
      ...parsed.options,
      rootDir: projectRoot,
      outDir: tmpDir,
      module: ts.ModuleKind.ES2020,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: false,
      declaration: false,
      sourceMap: false,
    };
    const program = ts.createProgram(parsed.fileNames, compilerOptions);
    const emitResult = program.emit();
    if (emitResult.emitSkipped) {
      const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
      const formatted = allDiagnostics.map((diag) => {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        if (diag.file && typeof diag.start === "number") {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
          return `${diag.file.fileName} (${line + 1},${character + 1}): ${message}`;
        }
        return message;
      });
      throw new Error(`TypeScript emit failed:\n${formatted.join("\n")}`);
    }
    const emittedTests = files.map((file) => {
      const relative = path.relative(projectRoot, file);
      const jsPath = path.join(tmpDir, relative).replace(/\.ts$/, ".js");
      const finalPath = rewriteVitestImports(jsPath, vitestEntry);
      return finalPath ?? jsPath;
    });
    return emittedTests;
  };

  return {
    pushSuite: (name, fn) => {
      suiteStack.push({ name });
      try {
        fn();
      } finally {
        suiteStack.pop();
      }
    },
    registerTest: (name, fn) => {
      recordTest(name, fn);
    },
    expect,
    vi,
    runTests,
    compileTests,
  };
};

export const discoverTests = (testDir) => {
  const found = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.test\.ts$/.test(entry.name) || /\.spec\.ts$/.test(entry.name)) {
        found.push(full);
      }
    }
  };
  walk(testDir);
  return found;
};

export const loadCompiledTest = async (file) => {
  const url = pathToFileURL(file);
  await import(url.href);
};
