import type { TestFunction } from "./index.js";

export declare function resetRuntime(): void;
export declare function describe(name: string, fn: () => void): void;
export declare function it(name: string, fn: TestFunction): void;
export declare function expect<T>(value: T | (() => unknown)): {
  toBe(expected: T): void;
  toThrowError(): void;
};
export declare function runRegisteredTests(): Promise<void>;
