const tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
const beforeEachHooks: Array<() => Promise<void> | void> = [];
let currentSuite = "";

export function describe(name: string, fn: () => void) {
  const previous = currentSuite;
  currentSuite = previous ? `${previous} ${name}` : name;
  fn();
  currentSuite = previous;
}

export function it(name: string, fn: () => Promise<void> | void) {
  const testName = currentSuite ? `${currentSuite} ${name}` : name;
  tests.push({ name: testName, fn });
}

export function beforeEach(fn: () => Promise<void> | void) {
  beforeEachHooks.push(fn);
}

export function expect<T>(value: T) {
  return {
    toBe(expected: any) {
      if (value !== expected) {
        throw new Error(`Expected ${value} to be ${expected}`);
      }
    },
    toEqual(expected: any) {
      const actualJson = JSON.stringify(value);
      const expectedJson = JSON.stringify(expected);
      if (actualJson !== expectedJson) {
        throw new Error(`Expected ${actualJson} to equal ${expectedJson}`);
      }
    },
    toHaveLength(expected: number) {
      if ((value as any).length !== expected) {
        throw new Error(`Expected length ${(value as any).length} to be ${expected}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (!(value as any > expected)) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
    toContain(item: any) {
      if (!Array.isArray(value) || !(value as any).includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    },
  };
}

export async function run() {
  let failures = 0;
  for (const test of tests) {
    try {
      for (const hook of beforeEachHooks) {
        await hook();
      }
      await test.fn();
      console.log(`✓ ${test.name}`);
    } catch (err) {
      failures += 1;
      console.error(`✗ ${test.name}`);
      console.error(err instanceof Error ? err.stack : err);
    }
  }
  console.log(`Executed ${tests.length} tests with ${failures} failures`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}
