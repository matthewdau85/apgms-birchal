import assert from "node:assert";

type TestFn = () => void | Promise<void>;

type RegisteredTest = {
  name: string;
  fn: TestFn;
};

const tests: RegisteredTest[] = [];
const suiteStack: string[] = [];

export const describe = (name: string, fn: () => void) => {
  suiteStack.push(name);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
};

export const it = (name: string, fn: TestFn) => {
  const prefix = suiteStack.join(" › ");
  const fullName = prefix ? `${prefix} › ${name}` : name;
  tests.push({ name: fullName, fn });
};

type Expectation<T> = {
  toBe: (expected: T) => void;
  toBeCloseTo: (expected: number, precision?: number) => void;
  toMatchObject: (expected: Partial<T>) => void;
  toBeInstanceOf: (expected: new (...args: any[]) => any) => void;
  not: {
    toThrow: () => void;
  };
};

const toBeCloseTo = (received: number, expected: number, precision = 2) => {
  const factor = 10 ** precision;
  assert.strictEqual(Math.round(received * factor), Math.round(expected * factor));
};

export const expect = <T>(received: T): Expectation<T> => ({
  toBe: (expected) => {
    assert.strictEqual(received, expected);
  },
  toBeCloseTo: (expected: number, precision?: number) => {
    assert.strictEqual(typeof received, "number");
    toBeCloseTo(received as unknown as number, expected, precision);
  },
  toMatchObject: (expected: Partial<T>) => {
    for (const [key, value] of Object.entries(expected)) {
      assert.deepStrictEqual(
        (received as unknown as Record<string, unknown>)[key],
        value,
      );
    }
  },
  toBeInstanceOf: (expectedCtor) => {
    assert.ok(received instanceof expectedCtor);
  },
  not: {
    toThrow: () => {
      assert.strictEqual(typeof received, "function");
      let threw = false;
      try {
        (received as unknown as () => void)();
      } catch (error) {
        threw = true;
      }
      assert.strictEqual(threw, false);
    },
  },
});

export const runRegisteredTests = async () => {
  let failed = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✓ ${test.name}`);
    } catch (error) {
      failed += 1;
      console.error(`✗ ${test.name}`);
      console.error(error instanceof Error ? error.stack ?? error.message : error);
    }
  }
  return { failed };
};
