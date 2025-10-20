const suiteStack = [];
const tests = [];

function describe(name, fn) {
  suiteStack.push(name);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
}

function it(name, fn) {
  const fullName = [...suiteStack, name].join(" › ");
  tests.push({ name: fullName, fn });
}

function expect(received) {
  return {
    toBe(expected) {
      if (received !== expected) {
        throw new Error(`Expected ${formatValue(received)} to be ${formatValue(expected)}`);
      }
    },
    toThrowError(expected) {
      if (typeof received !== "function") {
        throw new Error("toThrowError expects a function");
      }

      let thrown = false;
      let error;
      try {
        received();
      } catch (err) {
        thrown = true;
        error = err;
      }

      if (!thrown) {
        throw new Error("Expected function to throw an error");
      }

      if (expected instanceof RegExp) {
        const message = String(error?.message ?? error);
        if (!expected.test(message)) {
          throw new Error(`Expected error message ${message} to match ${expected}`);
        }
      } else if (typeof expected === "string") {
        const message = String(error?.message ?? error);
        if (!message.includes(expected)) {
          throw new Error(`Expected error message ${message} to include ${expected}`);
        }
      }
    },
  };
}

function consumeTests() {
  const snapshot = tests.slice();
  tests.length = 0;
  return snapshot;
}

function reset() {
  suiteStack.length = 0;
  tests.length = 0;
}

function formatValue(value) {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

module.exports = {
  describe,
  it,
  expect,
  __consumeTests: consumeTests,
  __reset: reset,
};
