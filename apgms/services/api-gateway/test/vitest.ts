type Hook = () => unknown | Promise<unknown>;
type TestCase = () => unknown | Promise<unknown>;

type MockFn<T extends (...args: any[]) => any> = T & {
  mock: {
    calls: Parameters<T>[];
  };
  mockClear: () => void;
  mockReset: () => void;
  mockResolvedValue: (value: any) => MockFn<T>;
};

interface Suite {
  name: string;
  tests: { name: string; fn: TestCase }[];
  beforeEach: Hook[];
}

const suites: Suite[] = [];
let currentSuite: Suite | null = null;

const queueRun = () => {
  if ((queueRun as any).scheduled) {
    return;
  }
  (queueRun as any).scheduled = true;
  process.nextTick(runSuites);
};

async function runSuites() {
  for (const suite of suites) {
    console.log(`Suite: ${suite.name}`);
    for (const test of suite.tests) {
      try {
        for (const hook of suite.beforeEach) {
          await hook();
        }
        await test.fn();
        console.log(`  ✓ ${test.name}`);
      } catch (error) {
        console.error(`  ✗ ${test.name}`);
        console.error(error);
        process.exitCode = 1;
      }
    }
  }
}

export const describe = (name: string, fn: () => void) => {
  const parentSuite = currentSuite;
  const suite: Suite = { name, tests: [], beforeEach: [] };
  currentSuite = suite;
  fn();
  suites.push(suite);
  currentSuite = parentSuite;
  queueRun();
};

export const beforeEach = (hook: Hook) => {
  if (!currentSuite) {
    throw new Error("beforeEach must be called within describe");
  }
  currentSuite.beforeEach.push(hook);
};

export const it = (name: string, fn: TestCase) => {
  if (!currentSuite) {
    throw new Error("it must be called within describe");
  }
  currentSuite.tests.push({ name, fn });
};

type Expectation<T> = {
  toBe: (expected: T) => void;
  toEqual: (expected: unknown) => void;
  toThrow: (matcher?: RegExp | string) => void;
  toBeGreaterThan: (value: number) => void;
  toBeGreaterThanOrEqual: (value: number) => void;
  not: Expectation<T>;
  toHaveBeenCalled: () => void;
};

const isMockFn = (value: unknown): value is { mock?: { calls: unknown[][] } } => {
  return !!value && typeof value === "function" && "mock" in (value as any);
};

const createExpectation = <T>(value: T, negate = false): Expectation<T> => {
  const compare = (condition: boolean, message: string) => {
    const pass = negate ? !condition : condition;
    if (!pass) {
      throw new Error(message);
    }
  };

  const expectation: Expectation<T> = {
    toBe(expected: T) {
      compare(Object.is(value, expected), `Expected ${value as any} to be ${expected as any}`);
    },
    toEqual(expected: unknown) {
      const actualJson = JSON.stringify(value);
      const expectedJson = JSON.stringify(expected);
      compare(actualJson === expectedJson, `Expected ${actualJson} to equal ${expectedJson}`);
    },
    toThrow(matcher?: RegExp | string) {
      if (typeof value !== "function") {
        throw new Error("toThrow expects a function");
      }
      let thrown = null;
      try {
        (value as unknown as () => unknown)();
      } catch (error) {
        thrown = error;
      }
      compare(thrown !== null, "Expected function to throw");
      if (thrown && matcher) {
        const message = (thrown as Error).message ?? String(thrown);
        if (matcher instanceof RegExp) {
          compare(matcher.test(message), `Expected error message to match ${matcher}`);
        } else {
          compare(message.includes(matcher), `Expected error message to include ${matcher}`);
        }
      }
    },
    toBeGreaterThan(threshold: number) {
      if (typeof (value as any) !== "number") {
        throw new Error("toBeGreaterThan expects a number");
      }
      compare((value as any) > threshold, `Expected ${value as any} to be greater than ${threshold}`);
    },
    toBeGreaterThanOrEqual(threshold: number) {
      if (typeof (value as any) !== "number") {
        throw new Error("toBeGreaterThanOrEqual expects a number");
      }
      compare((value as any) >= threshold, `Expected ${value as any} to be greater than or equal to ${threshold}`);
    },
    toHaveBeenCalled() {
      if (!isMockFn(value)) {
        throw new Error("toHaveBeenCalled expects a vi.fn mock");
      }
      compare(value.mock?.calls.length ? value.mock.calls.length > 0 : false, "Expected mock to have been called");
    },
    get not() {
      return createExpectation(value, !negate);
    },
  };

  return expectation;
};

export const expect = <T>(value: T): Expectation<T> => createExpectation(value);

type MockImplementation<T extends (...args: any[]) => any> = {
  impl: T;
};

const createMock = <T extends (...args: any[]) => any>(implementation?: T): MockFn<T> => {
  const impl: MockImplementation<T> = {
    impl: (implementation ?? ((() => undefined) as T)) as T,
  };

  const mockFn: any = (...args: Parameters<T>) => {
    mockFn.mock.calls.push(args);
    return impl.impl(...args);
  };
  mockFn.mock = { calls: [] as Parameters<T>[] };
  mockFn.mockClear = () => {
    mockFn.mock.calls = [];
  };
  mockFn.mockReset = () => {
    mockFn.mockClear();
    impl.impl = (implementation ?? ((() => undefined) as T)) as T;
  };
  mockFn.mockResolvedValue = (value: any) => {
    impl.impl = ((..._args: Parameters<T>) => Promise.resolve(value)) as T;
    return mockFn;
  };
  return mockFn as MockFn<T>;
};

const moduleMocks = new Map<string, () => any>();

export const vi = {
  fn: createMock,
  mock(modulePath: string, factory: () => any) {
    moduleMocks.set(modulePath, factory);
  },
  async importActual<T>(modulePath: string): Promise<T> {
    const module = await import(modulePath);
    return module as T;
  },
};

const dynamicImport = async (specifier: string) => {
  if (moduleMocks.has(specifier)) {
    return moduleMocks.get(specifier)!();
  }
  return import(specifier);
};

export const dynamicImportModule = dynamicImport;
