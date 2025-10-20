// Minimal workspace-provided shim for the Playwright test API used by smoke tests.
const { URL } = require('url');

const tests = [];
const onlyTests = [];

function test(name, fn) {
  if (typeof name !== 'string') {
    throw new TypeError('Test name must be a string');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Test callback must be a function');
  }
  tests.push({ name, fn });
}

function registerOnly(name, fn) {
  if (typeof name !== 'string' || typeof fn !== 'function') {
    throw new TypeError('test.only requires a name and a function');
  }
  onlyTests.push({ name, fn });
}

test.only = registerOnly;
test.skip = () => {};

test.describe = (name, suite) => {
  if (typeof suite === 'function') {
    suite();
  }
};

test.beforeAll = () => {};
test.afterAll = () => {};
test.beforeEach = () => {};
test.afterEach = () => {};

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toEqual(expected) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${actualStr} to equal ${expectedStr}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error('Expected value to be truthy');
      }
    }
  };
}

function createRequest(baseURL, defaultHeaders) {
  const headers = Object.assign({}, defaultHeaders);

  function resolveUrl(target) {
    try {
      return new URL(target, baseURL).toString();
    } catch (error) {
      throw new Error(`Failed to resolve request URL for ${target}: ${error.message}`);
    }
  }

  async function execute(method, target, options = {}) {
    const url = resolveUrl(target);
    const mergedHeaders = { ...headers, ...(options.headers || {}) };
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: mergedHeaders,
        body: options.body,
      });
    } catch (error) {
      throw new Error(`Request to ${url} failed: ${error instanceof Error ? error.message : error}`);
    }
    return wrapResponse(response);
  }

  return {
    get(target, options) {
      return execute('GET', target, options);
    },
    post(target, options) {
      return execute('POST', target, options);
    },
    put(target, options) {
      return execute('PUT', target, options);
    },
    delete(target, options) {
      return execute('DELETE', target, options);
    }
  };
}

function wrapResponse(response) {
  return {
    status() {
      return response.status;
    },
    ok() {
      return response.ok;
    },
    async json() {
      return response.json();
    },
    async text() {
      return response.text();
    },
    raw: response
  };
}

async function run(options = {}) {
  const { baseURL = 'http://localhost:3000', headers = {} } = options;
  const runnable = onlyTests.length > 0 ? onlyTests : tests;

  if (runnable.length === 0) {
    console.log('No tests found.');
    return { passed: 0, failed: 0 };
  }

  let passed = 0;
  let failed = 0;

  for (const entry of runnable) {
    try {
      await entry.fn({ request: createRequest(baseURL, headers) });
      console.log(`✓ ${entry.name}`);
      passed += 1;
    } catch (error) {
      console.error(`✗ ${entry.name}`);
      console.error(error instanceof Error ? error.stack : error);
      failed += 1;
    }
  }

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed`);
  }

  return { passed, failed };
}

module.exports = {
  test,
  expect,
  _run: run,
};
