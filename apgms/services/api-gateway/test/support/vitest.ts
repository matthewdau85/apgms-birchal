type TestFn = () => void | Promise<void>;

type TestCase = {
  name: string;
  fn: TestFn;
};

type Hook = () => void | Promise<void>;

const registry = {
  tests: [] as TestCase[],
  beforeEach: [] as Hook[],
};

export function describe(_name: string, fn: () => void): void {
  fn();
}

export function it(name: string, fn: TestFn): void {
  registry.tests.push({ name, fn });
}

export const test = it;

export function beforeEach(fn: Hook): void {
  registry.beforeEach.push(fn);
}

function createMatchers<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${actual as unknown as string} to be ${expected as unknown as string}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof (actual as unknown) !== "number" || (actual as unknown as number) < expected) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeCloseTo(expected: number, precision = 2) {
      if (typeof (actual as unknown) !== "number") {
        throw new Error("Actual value is not a number");
      }
      const delta = Math.pow(10, -precision) * 1.5;
      if (Math.abs((actual as unknown as number) - expected) > delta) {
        throw new Error(`Expected ${actual} to be close to ${expected}`);
      }
    },
  } satisfies Record<string, (...args: any[]) => any>;
}

function isPromise<T>(value: unknown): value is PromiseLike<T> {
  return typeof value === "object" && value !== null && "then" in (value as any);
}

function createAsyncMatchers<T>(promise: PromiseLike<T>) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        return (...args: unknown[]) =>
          promise.then((value) => {
            const matchers = createMatchers(value as T);
            const matcher = (matchers as Record<PropertyKey, (...a: unknown[]) => unknown>)[prop];
            if (typeof matcher !== "function") {
              throw new Error(`Unknown matcher ${(prop as string) ?? String(prop)}`);
            }
            return matcher(...(args as [unknown]));
          });
      },
    },
  );
}

export function expect<T>(actual: T): ReturnType<typeof createMatchers<T>> & { resolves: ReturnType<typeof createAsyncMatchers<T>> } {
  if (isPromise(actual)) {
    return {
      resolves: createAsyncMatchers(actual),
    } as any;
  }
  return Object.assign(createMatchers(actual), {
    resolves: createAsyncMatchers(Promise.resolve(actual)),
  }) as any;
}

export async function runRegisteredTests(): Promise<void> {
  for (const testCase of registry.tests) {
    for (const hook of registry.beforeEach) {
      await hook();
    }
    await testCase.fn();
  }
}

export function resetRegistry(): void {
  registry.tests.length = 0;
  registry.beforeEach.length = 0;
}

