import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

import {
  CircuitBreakerOpenError,
  HttpClient,
  HttpClientError,
} from "../src/httpClient";

const BASE_URL = "https://example.test";

function mockAbortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

test("retries stop after the configured number of attempts", async (t) => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    throw mockAbortError();
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new HttpClient({ baseUrl: BASE_URL, maxRetries: 2, timeout: 10 });

  await assert.rejects(client.request({ path: "/fail" }), (error) => {
    assert.ok(error instanceof HttpClientError);
    assert.equal(error.retryable, true);
    assert.equal(error.attempt, 3);
    return true;
  });

  assert.equal(callCount, 3);
});

test("successful responses are returned with parsed JSON payloads", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new HttpClient({ baseUrl: BASE_URL });
  const response = await client.request<{ ok: boolean }>({ path: "/health" });

  assert.equal(response.status, 200);
  assert.deepEqual(response.data, { ok: true });
  assert.equal(response.url, `${BASE_URL}/health`);
});

test("the circuit breaker opens after repeated failures", async (t) => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    throw new Error("network down");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new HttpClient({
    baseUrl: BASE_URL,
    maxRetries: 0,
    circuitBreaker: {
      failureThreshold: 2,
      successThreshold: 1,
      resetTimeout: 1000,
    },
  });

  await assert.rejects(client.request({ path: "/unstable" }), HttpClientError);
  await assert.rejects(client.request({ path: "/unstable" }), HttpClientError);
  await assert.rejects(client.request({ path: "/unstable" }), CircuitBreakerOpenError);

  assert.equal(callCount, 2);
});

test("the circuit breaker allows recovery after the reset timeout", async (t) => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  const client = new HttpClient({
    baseUrl: BASE_URL,
    maxRetries: 0,
    circuitBreaker: {
      failureThreshold: 1,
      successThreshold: 1,
      resetTimeout: 50,
    },
  });

  globalThis.fetch = async () => {
    callCount += 1;
    throw new Error("network down");
  };

  await assert.rejects(client.request({ path: "/flaky" }), HttpClientError);
  await assert.rejects(client.request({ path: "/flaky" }), CircuitBreakerOpenError);

  await sleep(60);

  globalThis.fetch = async () => {
    callCount += 1;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const response = await client.request<{ ok: boolean }>({ path: "/flaky" });
  assert.deepEqual(response.data, { ok: true });
  assert.equal(callCount, 2);

  t.after(() => {
    globalThis.fetch = originalFetch;
  });
});
