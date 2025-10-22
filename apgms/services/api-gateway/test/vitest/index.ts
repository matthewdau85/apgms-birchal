import { isDeepStrictEqual } from "node:util";

type Hook = () => void | Promise<void>;
type TestFn = () => void | Promise<void>;

type Suite = {
  name: string;
  parent?: Suite;
  suites: Suite[];
  tests: { name: string; fn: TestFn }[];
  beforeAll: Hook[];
  afterAll: Hook[];
  beforeEach: Hook[];
  afterEach: Hook[];
};

type SpyRecord = {
  object: Record<PropertyKey, any>;
  method: PropertyKey;
  original: (...args: any[]) => any;
  spy: Spy;
};

type Spy = ((...args: any[]) => any) & {
  mock: { calls: any[][] };
  impl?: (...args: any[]) => any;
  mockImplementation: (impl: (...args: any[]) => any) => Spy;
  mockResolvedValue: (value: any) => Spy;
  mockRejectedValue: (error: any) => Spy;
  mockRestore: () => void;
};

const rootSuite: Suite = createSuite("(root)");
let currentSuite = rootSuite;
const spies: SpyRecord[] = [];

function createSuite(name: string, parent?: Suite): Suite {
  return {
    name,
    parent,
    suites: [],
    tests: [],
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  };
}

function ensureSuite(fn: () => void | Promise<void>, suite: Suite) {
  const previous = currentSuite;
  currentSuite = suite;
  const result = fn();
  currentSuite = previous;
  if (result && typeof (result as Promise<void>).then === "function") {
    throw new Error("Async describe callbacks are not supported in this stub");
  }
}

export function describe(name: string, fn: () => void | Promise<void>) {
  const suite = createSuite(name, currentSuite);
  currentSuite.suites.push(suite);
  ensureSuite(fn, suite);
}

export function it(name: string, fn: TestFn) {
  currentSuite.tests.push({ name, fn });
}

export const test = it;

export function beforeAll(hook: Hook) {
  currentSuite.beforeAll.push(hook);
}

export function afterAll(hook: Hook) {
  currentSuite.afterAll.push(hook);
}

export function beforeEach(hook: Hook) {
  currentSuite.beforeEach.push(hook);
}

export function afterEach(hook: Hook) {
  currentSuite.afterEach.push(hook);
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      assert(actual === expected, `Expected ${formatValue(actual)} to be ${formatValue(expected)}`);
    },
    toEqual(expected: any) {
      assert(
        isDeepStrictEqual(actual, expected),
        `Expected ${formatValue(actual)} to deeply equal ${formatValue(expected)}`
      );
    },
    toBeTruthy() {
      assert(!!actual, `Expected ${formatValue(actual)} to be truthy`);
    },
    toBeUndefined() {
      assert(actual === undefined, `Expected value to be undefined but received ${formatValue(actual)}`);
    },
    toHaveLength(length: number) {
      assert(actual != null && typeof actual.length === "number", "Actual value has no length");
      assert(actual.length === length, `Expected length ${length} but received ${actual.length}`);
    },
    toHaveBeenCalledTimes(expectedTimes: number) {
      assert(actual && actual.mock && Array.isArray(actual.mock.calls), "Expected a spy to have mock calls");
      assert(
        actual.mock.calls.length === expectedTimes,
        `Expected ${expectedTimes} calls but received ${actual.mock.calls.length}`
      );
    },
    toHaveBeenCalledWith(...expectedArgs: any[]) {
      assert(actual && actual.mock && Array.isArray(actual.mock.calls), "Expected a spy to have mock calls");
      const match = actual.mock.calls.some((call: any[]) => isDeepStrictEqual(call, expectedArgs));
      assert(match, `Expected spy to be called with ${formatValue(expectedArgs)} but calls were ${formatValue(actual.mock.calls)}`);
    },
  };
}

export { expect };

function createSpy(object: Record<PropertyKey, any>, method: PropertyKey): Spy {
  const original = object[method];
  if (typeof original !== "function") {
    throw new Error(`Cannot spy on ${String(method)} because it is not a function`);
  }
  const spy: Spy = function (this: unknown, ...args: any[]) {
    spy.mock.calls.push(args);
    if (spy.impl) {
      return spy.impl.apply(this, args);
    }
    return original.apply(this, args);
  } as Spy;
  spy.mock = { calls: [] };
  spy.mockImplementation = (impl: (...args: any[]) => any) => {
    spy.impl = impl;
    return spy;
  };
  spy.mockResolvedValue = (value: any) => spy.mockImplementation(() => Promise.resolve(value));
  spy.mockRejectedValue = (error: any) => spy.mockImplementation(() => Promise.reject(error));
  spy.mockRestore = () => {
    object[method] = original;
    spy.mock.calls = [];
    spy.impl = undefined;
  };
  object[method] = spy;
  spies.push({ object, method, original, spy });
  return spy;
}

function createMockFunction(implementation?: (...args: any[]) => any): Spy {
  const mockTarget = { fn: implementation ?? (() => undefined) };
  return createSpy(mockTarget, "fn");
}

export const vi = {
  spyOn: createSpy,
  fn: createMockFunction,
  restoreAllMocks() {
    while (spies.length) {
      const record = spies.pop();
      if (!record) continue;
      record.object[record.method] = record.original;
      record.spy.mock.calls = [];
      record.spy.impl = undefined;
    }
  },
};

type RunStats = {
  passed: number;
  failed: number;
};

async function runHooks(hooks: Hook[], stats: RunStats, label: string) {
  for (const hook of hooks) {
    try {
      await hook();
    } catch (error) {
      stats.failed += 1;
      console.error(`✗ ${label} hook failed`);
      console.error(error);
    }
  }
}

function lineageNames(lineage: Suite[], testName?: string): string {
  const parts = lineage.filter((suite) => suite.name !== "(root)").map((suite) => suite.name);
  if (testName) {
    parts.push(testName);
  }
  return parts.join(" › ");
}

async function runSuite(suite: Suite, ancestors: Suite[], stats: RunStats) {
  const lineage = [...ancestors, suite];
  await runHooks(suite.beforeAll, stats, `${lineageNames(lineage)} beforeAll`);

  for (const testCase of suite.tests) {
    const beforeEachLineage = lineage.filter((s) => s !== rootSuite);
    for (const suiteForHook of beforeEachLineage) {
      await runHooks(suiteForHook.beforeEach, stats, `${lineageNames(lineage, testCase.name)} beforeEach`);
    }

    try {
      await testCase.fn();
      stats.passed += 1;
      console.log(`✓ ${lineageNames(lineage, testCase.name)}`);
    } catch (error) {
      stats.failed += 1;
      console.error(`✗ ${lineageNames(lineage, testCase.name)}`);
      console.error(error);
    }

    const afterEachLineage = lineage.filter((s) => s !== rootSuite);
    for (let i = afterEachLineage.length - 1; i >= 0; i -= 1) {
      await runHooks(afterEachLineage[i].afterEach, stats, `${lineageNames(lineage, testCase.name)} afterEach`);
    }
  }

  for (const child of suite.suites) {
    await runSuite(child, lineage, stats);
  }

  await runHooks(suite.afterAll, stats, `${lineageNames(lineage)} afterAll`);
}

export async function run() {
  const stats: RunStats = { passed: 0, failed: 0 };
  await runSuite(rootSuite, [], stats);
  console.log(`\n${stats.passed} passed, ${stats.failed} failed`);
  return stats.failed === 0;
}
