import assert from "node:assert/strict";

type Hook = () => void | Promise<void>;

type TestCase = {
  name: string;
  fn: () => void | Promise<void>;
  suite: Suite;
};

type Suite = {
  name: string;
  tests: TestCase[];
  suites: Suite[];
  beforeAll: Hook[];
  afterEach: Hook[];
  parent?: Suite;
};

const createSuite = (name: string, parent?: Suite): Suite => ({
  name,
  tests: [],
  suites: [],
  beforeAll: [],
  afterEach: [],
  parent,
});

const rootSuite = createSuite("");
const suiteStack: Suite[] = [rootSuite];

const currentSuite = (): Suite => suiteStack[suiteStack.length - 1];

export const describe = (name: string, fn: () => void) => {
  const parent = currentSuite();
  const suite = createSuite(name, parent);
  parent.suites.push(suite);
  suiteStack.push(suite);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
};

export const it = (name: string, fn: () => void | Promise<void>) => {
  const suite = currentSuite();
  suite.tests.push({ name, fn, suite });
};

export const beforeAll = (fn: Hook) => {
  currentSuite().beforeAll.push(fn);
};

export const afterEach = (fn: Hook) => {
  currentSuite().afterEach.push(fn);
};

class Expectation<T> {
  constructor(private readonly actual: T) {}

  toBe(expected: T) {
    assert.strictEqual(this.actual, expected);
  }

  toEqual(expected: unknown) {
    assert.deepStrictEqual(this.actual, expected);
  }

  toMatchObject(expected: unknown) {
    matchObject(this.actual, expected);
  }
}

const matchObject = (actual: unknown, expected: unknown) => {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), "Expected an array");
    assert.strictEqual(actual.length, expected.length);
    expected.forEach((item, index) => matchObject((actual as unknown[])[index], item));
    return;
  }

  if (expected === null || typeof expected !== "object") {
    assert.strictEqual(actual, expected);
    return;
  }

  assert.ok(actual !== null && typeof actual === "object", "Expected an object");
  for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
    matchObject((actual as Record<string, unknown>)[key], value);
  }
};

export const expect = <T>(actual: T) => new Expectation(actual);

const runSuite = async (suite: Suite, ancestors: string[], inheritedAfterEach: Hook[]): Promise<boolean> => {
  let success = true;
  const path = suite.name ? [...ancestors, suite.name] : ancestors;

  for (const hook of suite.beforeAll) {
    await hook();
  }

  const allAfterEach = [...suite.afterEach, ...inheritedAfterEach];

  for (const test of suite.tests) {
    const fullName = [...path, test.name].join(" ");
    try {
      await test.fn();
      console.log(`✓ ${fullName}`);
    } catch (error) {
      success = false;
      console.error(`✗ ${fullName}`);
      console.error(error);
    } finally {
      for (const hook of allAfterEach) {
        try {
          await hook();
        } catch (error) {
          success = false;
          console.error(`✗ afterEach hook failed for ${fullName}`);
          console.error(error);
        }
      }
    }
  }

  for (const child of suite.suites) {
    const childSuccess = await runSuite(child, path, allAfterEach);
    success = success && childSuccess;
  }

  return success;
};

export const runSuites = async (): Promise<boolean> => {
  return runSuite(rootSuite, [], []);
};
