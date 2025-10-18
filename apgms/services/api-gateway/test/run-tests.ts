import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

interface HookSet {
  beforeEach: Array<() => void | Promise<void>>;
  afterEach: Array<() => void | Promise<void>>;
}

const tests: Array<TestCase & { hooks: HookSet[] }> = [];
const suiteStack: string[] = [];
const hookStack: HookSet[] = [{ beforeEach: [], afterEach: [] }];

const currentName = (name: string) =>
  [...suiteStack, name].filter(Boolean).join(" ");

(globalThis as any).describe = (name: string, fn: () => void | Promise<void>) => {
  suiteStack.push(name);
  hookStack.push({ beforeEach: [], afterEach: [] });
  try {
    void fn();
  } finally {
    hookStack.pop();
    suiteStack.pop();
  }
};

(globalThis as any).it = (name: string, fn: () => void | Promise<void>) => {
  tests.push({ name: currentName(name), fn, hooks: [...hookStack] });
};

(globalThis as any).beforeEach = (fn: () => void | Promise<void>) => {
  hookStack[hookStack.length - 1].beforeEach.push(fn);
};

(globalThis as any).afterEach = (fn: () => void | Promise<void>) => {
  hookStack[hookStack.length - 1].afterEach.push(fn);
};

const createMock = (
  implementation: (...args: any[]) => any = () => undefined
) => {
  const callQueue: ((...args: any[]) => any)[] = [];
  let impl = implementation;
  const baseImplementation = implementation;

  const mockFn: any = (...args: any[]) => {
    mockFn.mock.calls.push(args);
    const behavior = callQueue.shift();
    if (behavior) {
      return behavior(...args);
    }
    return impl(...args);
  };

  mockFn.mock = { calls: [] as unknown[][] };

  mockFn.mockResolvedValueOnce = (value: unknown) => {
    callQueue.push(() => Promise.resolve(value));
    return mockFn;
  };

  mockFn.mockRejectedValueOnce = (value: unknown) => {
    callQueue.push(() => Promise.reject(value));
    return mockFn;
  };

  mockFn.mockImplementation = (nextImpl: (...args: any[]) => any) => {
    impl = nextImpl;
    return mockFn;
  };

  mockFn.mockReset = () => {
    mockFn.mock.calls = [];
    callQueue.length = 0;
    impl = baseImplementation;
    return mockFn;
  };

  return mockFn;
};

(globalThis as any).jest = {
  fn: (implementation?: (...args: any[]) => any) =>
    createMock(implementation ?? (() => undefined)),
};

(globalThis as any).expect = (actual: any) => ({
  toBe(expected: any) {
    assert.strictEqual(actual, expected);
  },
  toEqual(expected: any) {
    assert.deepStrictEqual(actual, expected);
  },
  toHaveBeenCalledTimes(expected: number) {
    const calls = actual?.mock?.calls?.length ?? 0;
    assert.strictEqual(calls, expected);
  },
});

const files = process.argv.slice(2);
const specs = files.length > 0 ? files : ["test/health.spec.ts"];

for (const file of specs) {
  const resolved = path.resolve(file);
  await import(pathToFileURL(resolved).href);
}

let failed = false;
for (const { name, fn, hooks } of tests) {
  try {
    for (const hook of hooks.flatMap((set) => set.beforeEach)) {
      await hook();
    }
    await fn();
    for (const hook of hooks
      .slice()
      .reverse()
      .flatMap((set) => set.afterEach)) {
      await hook();
    }
    console.log(`\u2713 ${name}`);
  } catch (error) {
    failed = true;
    console.error(`\u2717 ${name}`);
    console.error(error);
    for (const hook of hooks
      .slice()
      .reverse()
      .flatMap((set) => set.afterEach)) {
      try {
        await hook();
      } catch (hookError) {
        console.error(hookError);
      }
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
