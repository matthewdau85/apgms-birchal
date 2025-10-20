export type TestFunction = () => void | Promise<void>;

export declare function describe(name: string, fn: () => void): void;
export declare function it(name: string, fn: TestFunction): void;
export declare function test(name: string, fn: TestFunction): void;

export interface Expectation<T> {
  toBe(expected: T): void;
  toThrowError(): void;
}

export declare function expect<T>(value: T | (() => unknown)): Expectation<T>;
