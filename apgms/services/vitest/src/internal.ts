export type Hook = () => unknown | Promise<unknown>;
export type TestHandler = () => unknown | Promise<unknown>;

export interface TestCase {
  name: string;
  handler: TestHandler;
  suite: Suite;
}

export interface Suite {
  name: string;
  parent: Suite | null;
  suites: Suite[];
  tests: TestCase[];
  beforeEach: Hook[];
  afterEach: Hook[];
}

let rootSuite: Suite = createSuite("root", null);
let currentSuite: Suite = rootSuite;

function createSuite(name: string, parent: Suite | null): Suite {
  return {
    name,
    parent,
    suites: [],
    tests: [],
    beforeEach: [],
    afterEach: [],
  };
}

export function resetRegistry() {
  rootSuite = createSuite("root", null);
  currentSuite = rootSuite;
}

export function getRootSuite(): Suite {
  return rootSuite;
}

export function pushSuite(name: string, handler: () => unknown) {
  const parent = currentSuite;
  const suite = createSuite(name, parent);
  parent.suites.push(suite);
  currentSuite = suite;
  try {
    const result = handler();
    if (result instanceof Promise) {
      throw new Error("describe handlers must not return a promise");
    }
  } finally {
    currentSuite = parent;
  }
}

export function addTest(name: string, handler: TestHandler) {
  currentSuite.tests.push({ name, handler, suite: currentSuite });
}

export function addBeforeEach(handler: Hook) {
  currentSuite.beforeEach.push(handler);
}

export function addAfterEach(handler: Hook) {
  currentSuite.afterEach.push(handler);
}
