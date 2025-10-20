import type { describe as describeFn, it as itFn, test as testFn, expect as expectFn } from "./index.js";

declare global {
  const describe: typeof describeFn;
  const it: typeof itFn;
  const test: typeof testFn;
  const expect: typeof expectFn;
}

export {};
