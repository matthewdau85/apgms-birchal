export interface APIResponse {
  status(): number;
  ok(): boolean;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
  raw: Response;
}

export interface RequestContext {
  get(path: string, options?: RequestInit): Promise<APIResponse>;
  post(path: string, options?: RequestInit): Promise<APIResponse>;
  put(path: string, options?: RequestInit): Promise<APIResponse>;
  delete(path: string, options?: RequestInit): Promise<APIResponse>;
}

export interface TestFixtures {
  request: RequestContext;
}

export type TestFn = (fixtures: TestFixtures) => void | Promise<void>;

export interface TestAPI {
  (name: string, fn: TestFn): void;
  skip(name: string, fn: TestFn): void;
  only(name: string, fn: TestFn): void;
  describe(name: string, suite: () => void): void;
  beforeAll(fn: () => void | Promise<void>): void;
  afterAll(fn: () => void | Promise<void>): void;
  beforeEach(fn: () => void | Promise<void>): void;
  afterEach(fn: () => void | Promise<void>): void;
}

export interface Expectation<T = unknown> {
  toBe(expected: T): void;
  toEqual(expected: unknown): void;
  toBeTruthy(): void;
}

export declare const test: TestAPI;
export declare function expect<T = unknown>(actual: T): Expectation<T>;
