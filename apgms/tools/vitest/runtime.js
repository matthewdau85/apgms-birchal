import assert from "node:assert/strict";

const runtimeKey = Symbol.for("__vitestRuntime");

function getState() {
  const globalObject = globalThis;
  if (!globalObject[runtimeKey]) {
    globalObject[runtimeKey] = {
      suiteStack: [],
      tests: [],
    };
  }
  return globalObject[runtimeKey];
}

export function resetRuntime() {
  const state = getState();
  state.suiteStack = [];
  state.tests = [];
}

function currentName(name) {
  const { suiteStack } = getState();
  return [...suiteStack, name].join(" › ");
}

export function describe(name, fn) {
  const state = getState();
  state.suiteStack.push(name);
  try {
    fn();
  } finally {
    state.suiteStack.pop();
  }
}

export function it(name, fn) {
  const state = getState();
  state.tests.push({
    name: currentName(name),
    fn,
  });
}

export function expect(received) {
  return {
    toBe(expected) {
      assert.strictEqual(received, expected);
    },
    toThrowError() {
      assert.throws(typeof received === "function" ? received : () => {
        throw new TypeError("Received value must be a function");
      });
    },
  };
}

export async function runRegisteredTests() {
  const state = getState();
  let failures = 0;
  for (const test of state.tests) {
    try {
      await test.fn();
      process.stdout.write(`✓ ${test.name}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`✗ ${test.name}\n`);
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    }
  }
  if (failures > 0) {
    throw new Error(`${failures} test(s) failed`);
  }
}
