function getRunner(): any {
  const runner = (globalThis as any).__vitestRunner;
  if (!runner) {
    throw new Error("Vitest runner not initialised");
  }
  return runner;
}

export function describe(name: string, fn: () => void | Promise<void>): void {
  getRunner().describe(name, fn);
}

export function test(name: string, fn: () => void | Promise<void>): void {
  getRunner().test(name, fn);
}

export const it = test;

export function beforeEach(fn: () => void | Promise<void>): void {
  getRunner().beforeEach(fn);
}

export function afterEach(fn: () => void | Promise<void>): void {
  getRunner().afterEach(fn);
}

export function expect(actual: unknown) {
  return getRunner().expect(actual);
}

export const beforeAll = () => {
  throw new Error("beforeAll not implemented in lightweight vitest runner");
};

export const afterAll = () => {
  throw new Error("afterAll not implemented in lightweight vitest runner");
};
