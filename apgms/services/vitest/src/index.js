const rootSuites = [];
const suiteStack = [];
const activeSpies = new Set();

function createSuite(name) {
  return {
    name,
    tests: [],
    beforeEach: [],
    afterEach: [],
    children: [],
  };
}

function getCurrentSuite() {
  const current = suiteStack[suiteStack.length - 1];
  if (!current) {
    throw new Error("No active suite. Wrap tests in describe().");
  }
  return current;
}

export function describe(name, fn) {
  const suite = createSuite(name);
  const parent = suiteStack[suiteStack.length - 1];
  if (parent) {
    parent.children.push(suite);
  } else {
    rootSuites.push(suite);
  }

  suiteStack.push(suite);
  let cleaned = false;
  const cleanup = () => {
    if (!cleaned) {
      cleaned = true;
      suiteStack.pop();
    }
  };

  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.finally(cleanup);
    }
  } finally {
    cleanup();
  }
}

export function it(name, fn) {
  const suite = getCurrentSuite();
  suite.tests.push({ name, fn });
}

export const test = it;

export function beforeEach(fn) {
  const suite = getCurrentSuite();
  suite.beforeEach.push(fn);
}

export function afterEach(fn) {
  const suite = getCurrentSuite();
  suite.afterEach.push(fn);
}

function formatError(error) {
  if (!error) return "Unknown error";
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

export function expect(received) {
  return {
    toBe(expected) {
      if (received !== expected) {
        throw new Error(`Expected ${JSON.stringify(received)} to be ${JSON.stringify(expected)}`);
      }
    },
  };
}

function createSpy(target, property, original) {
  const spy = {
    impl: function (...args) {
      return original.apply(this, args);
    },
    restore() {
      target[property] = original;
      activeSpies.delete(spy);
    },
    mockImplementation(impl) {
      spy.impl = impl;
      return spy;
    },
    mockResolvedValue(value) {
      spy.impl = () => Promise.resolve(value);
      return spy;
    },
  };

  function wrapper(...args) {
    return spy.impl.apply(this, args);
  }

  target[property] = wrapper;
  activeSpies.add(spy);
  return spy;
}

export const vi = {
  spyOn(target, property) {
    const original = target[property];
    if (typeof original !== "function") {
      throw new Error("Can only spy on functions");
    }
    return createSpy(target, property, original);
  },
  restoreAllMocks() {
    for (const spy of Array.from(activeSpies)) {
      spy.restore();
    }
  },
};

async function runTest(test, hooks, depth, results) {
  const indent = "  ".repeat(depth + 1);
  try {
    for (const hook of hooks.beforeEach) {
      await hook();
    }
    await test.fn();
    console.log(`${indent}✓ ${test.name}`);
    results.passed += 1;
  } catch (error) {
    console.error(`${indent}✗ ${test.name}`);
    console.error(formatError(error));
    results.failed += 1;
  } finally {
    for (const hook of hooks.afterEach) {
      try {
        await hook();
      } catch (error) {
        console.error(`${indent}(afterEach) ${formatError(error)}`);
        results.failed += 1;
      }
    }
  }
}

async function runSuite(suite, parentHooks, depth, results) {
  const currentHooks = {
    beforeEach: [...parentHooks.beforeEach, ...suite.beforeEach],
    afterEach: [...suite.afterEach, ...parentHooks.afterEach],
  };

  const indent = "  ".repeat(depth);
  console.log(`${indent}${suite.name}`);

  for (const testCase of suite.tests) {
    await runTest(testCase, currentHooks, depth, results);
  }

  for (const child of suite.children) {
    await runSuite(child, currentHooks, depth + 1, results);
  }
}

export async function runSuites() {
  const results = { passed: 0, failed: 0 };
  for (const suite of rootSuites) {
    await runSuite(suite, { beforeEach: [], afterEach: [] }, 0, results);
  }
  return results;
}

export function resetSuites() {
  rootSuites.length = 0;
  suiteStack.length = 0;
  vi.restoreAllMocks();
}
