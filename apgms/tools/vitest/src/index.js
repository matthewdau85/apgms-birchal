import assert from "node:assert/strict";

const rootSuite = { name: "(root)", entries: [] };
const suiteStack = [];

function currentSuite() {
  return suiteStack[suiteStack.length - 1] ?? rootSuite;
}

export function resetState() {
  rootSuite.entries = [];
  suiteStack.length = 0;
}

export function getEntries() {
  return rootSuite.entries;
}

function addEntry(entry) {
  currentSuite().entries.push(entry);
}

export function describe(name, fn) {
  const suite = { type: "suite", name, entries: [] };
  addEntry(suite);
  suiteStack.push(suite);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
}

export function it(name, fn) {
  addEntry({ type: "test", name, fn });
}

export const test = it;

export function expect(received) {
  return {
    toBe(expected) {
      assert.strictEqual(received, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(received, expected);
    }
  };
}

export async function runEntries(entries, level = 0) {
  let passed = 0;
  let failed = 0;
  for (const entry of entries) {
    if (entry.type === "suite") {
      console.log(`${"  ".repeat(level)}${entry.name}`);
      const result = await runEntries(entry.entries, level + 1);
      passed += result.passed;
      failed += result.failed;
    } else if (entry.type === "test") {
      try {
        await entry.fn();
        console.log(`${"  ".repeat(level)}✓ ${entry.name}`);
        passed += 1;
      } catch (error) {
        console.log(`${"  ".repeat(level)}✗ ${entry.name}`);
        console.error(error);
        failed += 1;
      }
    }
  }
  return { passed, failed };
}
