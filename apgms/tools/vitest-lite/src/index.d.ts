export type TestFunction = () => void | Promise<void>;

export function describe(name: string, fn: () => void): void;
export function it(name: string, fn: TestFunction): void;
export const test: typeof it;

interface Matcher<T> {
  toBe(expected: T): void;
  toEqual(expected: unknown): void;
  toThrow(matcher?: RegExp | string): void;
  toThrowError(matcher?: RegExp | string): void;
  toBeGreaterThanOrEqual(expected: number): void;
}

interface Expect {
  <T>(value: T): Matcher<T>;
  any<T>(ctor: new (...args: any[]) => T): unknown;
}

export const expect: Expect;

export interface Mock<TArgs extends any[] = any[], TResult = any> {
  (...args: TArgs): TResult;
  mock: {
    calls: TArgs[];
  };
}

export const vi: {
  fn<TArgs extends any[], TResult>(impl?: (...args: TArgs) => TResult): Mock<TArgs, TResult>;
};
