export type Hook = () => void | Promise<void>;
export type TestFn = () => void | Promise<void>;

export interface Suite {
  name: string;
  tests: { name: string; fn: TestFn }[];
  suites: Suite[];
  beforeEach: Hook[];
  afterEach: Hook[];
  afterAll: Hook[];
}

interface VitestState {
  suites: Suite[];
  currentSuite: Suite | null;
  rootSuite?: Suite;
}

const state: VitestState = (globalThis as any).__vitestLiteState ?? {
  suites: [],
  currentSuite: null,
};

(globalThis as any).__vitestLiteState = state;

if (typeof process !== "undefined") {
  process.env.NODE_ENV ??= "test";
}

function createSuite(name: string): Suite {
  return {
    name,
    tests: [],
    suites: [],
    beforeEach: [],
    afterEach: [],
    afterAll: [],
  };
}

function getCurrentSuite(): Suite {
  if (!state.currentSuite) {
    if (!state.rootSuite) {
      state.rootSuite = createSuite("root");
      state.suites.push(state.rootSuite);
    }
    state.currentSuite = state.rootSuite;
  }
  return state.currentSuite;
}

export function describe(name: string, fn: () => void) {
  const parent = getCurrentSuite();
  const suite = createSuite(name);
  parent.suites.push(suite);
  state.currentSuite = suite;
  try {
    fn();
  } finally {
    state.currentSuite = parent;
  }
}

export const it = test;
export function test(name: string, fn: TestFn) {
  const suite = getCurrentSuite();
  suite.tests.push({ name, fn });
}

export function beforeEach(fn: Hook) {
  const suite = getCurrentSuite();
  suite.beforeEach.push(fn);
}

export function afterEach(fn: Hook) {
  const suite = getCurrentSuite();
  suite.afterEach.push(fn);
}

export function afterAll(fn: Hook) {
  const suite = getCurrentSuite();
  suite.afterAll.push(fn);
}

function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(a[key], b[key]));
}

function matchObject(actual: any, expected: any): boolean {
  if (typeof actual !== "object" || actual === null) return false;
  return Object.keys(expected).every((key) => {
    const expectedValue = expected[key];
    const actualValue = actual[key];
    if (typeof expectedValue === "object" && expectedValue !== null) {
      return matchObject(actualValue, expectedValue);
    }
    return deepEqual(actualValue, expectedValue);
  });
}

function format(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value);
}

export function expect(received: any) {
  return {
    toBe(expected: any) {
      if (!Object.is(received, expected)) {
        throw new Error(`Expected ${format(received)} to be ${format(expected)}`);
      }
    },
    toEqual(expected: any) {
      if (!deepEqual(received, expected)) {
        throw new Error(`Expected ${format(received)} to equal ${format(expected)}`);
      }
    },
    toMatchObject(expected: any) {
      if (!matchObject(received, expected)) {
        throw new Error(`Expected ${format(received)} to match object ${format(expected)}`);
      }
    },
    toHaveLength(length: number) {
      if ((received?.length ?? undefined) !== length) {
        throw new Error(`Expected value to have length ${length} but received ${received?.length}`);
      }
    },
    toBeCloseTo(expected: number, precision = 2) {
      const diff = Math.abs(Number(received) - Number(expected));
      const threshold = Math.pow(10, -precision) / 2;
      if (Number.isNaN(diff) || diff > threshold) {
        throw new Error(`Expected ${received} to be close to ${expected}`);
      }
    },
    toBeDefined() {
      if (typeof received === "undefined") {
        throw new Error(`Expected value to be defined`);
      }
    },
  };
}

export function getState() {
  return state;
}

export function resetState() {
  state.suites = [];
  state.currentSuite = null;
  state.rootSuite = undefined;
}
