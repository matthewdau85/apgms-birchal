#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const args = process.argv.slice(2);
const command = args.shift();

if (command !== "run") {
  console.error("Unsupported command. Use `vitest run`.");
  process.exit(1);
}

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test");

if (!fs.existsSync(testDir)) {
  console.log("No tests found.");
  process.exit(0);
}

const testFiles = collectTestFiles(testDir);

registerTypeScriptLoader(projectRoot);

let failures = 0;

for (const file of testFiles) {
  try {
    delete require.cache[file];
    require("../index.cjs").__reset();
    require(file);
    const cases = require("../index.cjs").__consumeTests();
    for (const testCase of cases) {
      runTestCase(testCase);
    }
  } catch (error) {
    failures += 1;
    console.error(`✖ ${relativePath(file)}`);
    console.error(formatError(error));
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`✓ Passed ${testFiles.length} file(s)`);
}

function collectTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
    } else if (/\.test\.[tj]s$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function registerTypeScriptLoader(baseDir) {
  require.extensions[".ts"] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    });
    module._compile(transpiled.outputText, filename);
  };

  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    try {
      return originalResolve.call(this, request, parent, isMain, options);
    } catch (error) {
      if (request.endsWith(".js")) {
        const tsRequest = request.replace(/\.js$/, ".ts");
        return originalResolve.call(this, tsRequest, parent, isMain, options);
      }
      throw error;
    }
  };
}

function runTestCase(testCase) {
  try {
    const result = testCase.fn();
    if (result && typeof result.then === "function") {
      console.warn(`⚠ Async tests are not supported: ${testCase.name}`);
    }
    console.log(`  ✓ ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`  ✖ ${testCase.name}`);
    console.error(formatError(error));
  }
}

function relativePath(file) {
  return path.relative(projectRoot, file);
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}
