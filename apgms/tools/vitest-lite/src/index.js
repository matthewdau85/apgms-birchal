const getRuntime = () => {
  const runtime = globalThis.__vitestLiteRuntime;
  if (!runtime) {
    throw new Error("vitest runtime is not initialised. Did you invoke the CLI?");
  }
  return runtime;
};

export const describe = (name, fn) => {
  getRuntime().pushSuite(name, fn);
};

export const it = (name, fn) => {
  getRuntime().registerTest(name, fn);
};

export const test = it;

export const expect = (...args) => {
  return getRuntime().expect(...args);
};

expect.any = (...args) => getRuntime().expect.any(...args);

export const vi = new Proxy(
  {},
  {
    get(_target, prop) {
      const runtime = getRuntime();
      return runtime.vi[prop];
    },
  }
);
