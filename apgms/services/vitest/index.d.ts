export type TestFn = () => void | Promise<void>;

export declare function describe(name: string, fn: TestFn): void;
export declare function it(name: string, fn: TestFn): void;
export declare const test: typeof it;
export declare function beforeEach(fn: TestFn): void;
export declare function afterEach(fn: TestFn): void;

export interface Expectation<T> {
  toBe(expected: T): void;
}

export declare function expect<T>(received: T): Expectation<T>;

export interface SpyInstance<T extends (...args: any[]) => any> {
  restore(): void;
  mockImplementation(impl: T): this;
  mockResolvedValue(value: any): this;
}

export interface Vi {
  spyOn<T extends Record<string, any>, K extends keyof T>(
    target: T,
    property: K,
  ): T[K] extends (...args: any[]) => any ? SpyInstance<T[K]> : never;
  restoreAllMocks(): void;
}

export declare const vi: Vi;

export interface SuiteResults {
  passed: number;
  failed: number;
}

export declare function runSuites(): Promise<SuiteResults>;
export declare function resetSuites(): void;
