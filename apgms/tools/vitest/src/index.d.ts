export type TestFunction = () => void | Promise<void>;
export type SuiteFunction = () => void;

export function describe(name: string, fn: SuiteFunction): void;
export function it(name: string, fn: TestFunction): void;
export const test: typeof it;
export function expect<T>(received: T): {
  toBe(expected: T): void;
  toEqual(expected: T): void;
};
export function resetState(): void;
export function getEntries(): unknown[];
export function runEntries(entries: unknown[], level?: number): Promise<{ passed: number; failed: number }>;
