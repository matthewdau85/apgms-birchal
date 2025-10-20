#!/usr/bin/env node

// Workspace shim CLI that executes the lightweight Playwright-compatible runner.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

require('tsx/register');

const runner = require('../index.js');

function collectSpecFiles(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSpecFiles(fullPath));
    } else if (/\.(spec|test)\.(t|j)sx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseHeaders() {
  const source = process.env.PLAYWRIGHT_EXTRA_HEADERS || process.env.PLAYWRIGHT_HEADERS || process.env.E2E_REQUEST_HEADERS;
  if (!source) {
    return {};
  }

  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('Headers definition must be a JSON object.');
  } catch (error) {
    throw new Error(`Failed to parse extra headers JSON: ${error.message}`);
  }
}

async function loadTestModule(filePath) {
  const moduleUrl = pathToFileURL(filePath).href;
  await import(moduleUrl);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] !== 'test') {
    console.error('Only "playwright test" command is supported in this workspace shim.');
    process.exitCode = 1;
    return;
  }

  const rootDir = process.cwd();
  const defaultDir = path.join(rootDir, 'tests', 'e2e');
  const testDir = process.env.PLAYWRIGHT_TEST_DIR || defaultDir;
  const files = collectSpecFiles(testDir);

  if (files.length === 0) {
    console.warn(`No test files found in ${testDir}`);
  }

  for (const file of files) {
    await loadTestModule(file);
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.GATEWAY_BASE_URL || 'http://localhost:3000';
  let headers = {};
  try {
    headers = parseHeaders();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  try {
    await runner._run({ baseURL, headers });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
