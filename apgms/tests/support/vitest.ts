import { isDeepStrictEqual } from "node:util";
import { AssertionError } from "node:assert";

type Hook = () => unknown | Promise<unknown>;

type TestCase = {
  name: string;
  fn: () => unknown | Promise<unknown>;
};

type SuiteEntry =
  | { type: "test"; test: TestCase }
  | { type: "suite"; suite: Suite };

type Suite = {
  name: string;
  entries: SuiteEntry[];
  beforeEachHooks: Hook[];
  afterEachHooks: Hook[];
};

const rootSuite: Suite = {
  name: "root",
  entries: [],
  beforeEachHooks: [],
  afterEachHooks: [],
};

const suiteStack: Suite[] = [rootSuite];

function currentSuite(): Suite {
  const suite = suiteStack[suiteStack.length - 1];
  if (!suite) {
    throw new Error("No active suite");
  }
  return suite;
}

export function describe(name: string, fn: () => void): void {
  const parent = currentSuite();
  const suite: Suite = {
    name,
    entries: [],
    beforeEachHooks: [],
    afterEachHooks: [],
  };
  parent.entries.push({ type: "suite", suite });
  suiteStack.push(suite);
  const result = fn();
  if (result && typeof (result as any).then === "function") {
    throw new Error("Async describe blocks are not supported");
  }
  suiteStack.pop();
}

export const it = (name: string, fn: () => unknown | Promise<unknown>): void => {
  currentSuite().entries.push({ type: "test", test: { name, fn } });
};

export const test = it;

export function beforeEach(fn: Hook): void {
  currentSuite().beforeEachHooks.push(fn);
}

export function afterEach(fn: Hook): void {
  currentSuite().afterEachHooks.push(fn);
}

export function getRootSuite(): Suite {
  return rootSuite;
}

export function expect<T>(actual: T) {
  return {
    toBe(expected: unknown) {
      if (!Object.is(actual, expected)) {
        throw new AssertionError({
          message: `Expected ${format(actual)} to be ${format(expected)}`,
        });
      }
    },
    toEqual(expected: unknown) {
      if (!isDeepStrictEqual(actual, expected)) {
        throw new AssertionError({
          message: `Expected ${format(actual)} to equal ${format(expected)}`,
        });
      }
    },
    toMatchObject(expected: Record<string, unknown>) {
      if (typeof actual !== "object" || actual === null) {
        throw new AssertionError({ message: "Actual value is not an object" });
      }
      for (const [key, value] of Object.entries(expected)) {
        if (!isDeepStrictEqual((actual as any)[key], value)) {
          throw new AssertionError({
            message: `Expected property ${key} to match ${format(value)} (received ${format((actual as any)[key])})`,
          });
        }
      }
    },
    toMatch(expected: RegExp | string) {
      if (typeof actual !== "string") {
        throw new AssertionError({ message: "Actual value is not a string" });
      }
      if (expected instanceof RegExp) {
        if (!expected.test(actual)) {
          throw new AssertionError({
            message: `Expected ${actual} to match ${expected.toString()}`,
          });
        }
      } else if (!actual.includes(expected)) {
        throw new AssertionError({
          message: `Expected ${actual} to contain ${expected}`,
        });
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new AssertionError({ message: `Expected ${format(actual)} to be truthy` });
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new AssertionError({ message: "Expected value to be defined" });
      }
    },
    toHaveLength(expected: number) {
      if ((actual as any)?.length !== expected) {
        throw new AssertionError({
          message: `Expected length ${(actual as any)?.length} to equal ${expected}`,
        });
      }
    },
  };
}

function format(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

export type { Suite, SuiteEntry, TestCase };
