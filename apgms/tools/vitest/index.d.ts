export type TestFunction = () => void;

export function describe(name: string, fn: TestFunction): void;
export function it(name: string, fn: TestFunction): void;

export interface Expectation<T> {
  toBe(expected: T): void;
  toThrowError(expected?: string | RegExp): void;
}

export function expect<T>(value: T): Expectation<T>;
