import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

import { CircuitOpenError, OutboundHttpClient } from '../src/http/outbound.js';

const BASE_URL = 'http://example.com/resource';

test('circuit opens after repeated 5xx responses and recovers after half-open success', async () => {
  const statuses = [500, 500, 200, 200];
  const calls: number[] = [];
  const client = new OutboundHttpClient({
    circuitBreaker: {
      failureThreshold: 2,
      resetTimeoutMs: 40,
    },
    retry: {
      retries: 0,
      baseDelayMs: 1,
    },
    fetchImpl: async () => {
      const status = statuses.shift() ?? 200;
      calls.push(status);
      await delay(1);
      return new Response(null, { status });
    },
  });

  const first = await client.request(BASE_URL);
  assert.equal(first.status, 500);

  const second = await client.request(BASE_URL);
  assert.equal(second.status, 500);

  await assert.rejects(client.request(BASE_URL), (error) => error instanceof CircuitOpenError);

  await delay(50);

  const third = await client.request(BASE_URL);
  assert.equal(third.status, 200);

  const fourth = await client.request(BASE_URL);
  assert.equal(fourth.status, 200);

  assert.deepEqual(calls, [500, 500, 200, 200]);
});

test('half-open failure sends circuit back to open state', async () => {
  const statuses = [500, 500, 500];
  const client = new OutboundHttpClient({
    circuitBreaker: {
      failureThreshold: 2,
      resetTimeoutMs: 30,
    },
    retry: {
      retries: 0,
      baseDelayMs: 1,
    },
    fetchImpl: async () => new Response(null, { status: statuses.shift() ?? 500 }),
  });

  await client.request(BASE_URL);
  await client.request(BASE_URL);

  await assert.rejects(client.request(BASE_URL), (error) => error instanceof CircuitOpenError);

  await delay(40);

  const halfOpen = await client.request(BASE_URL);
  assert.equal(halfOpen.status, 500);

  await assert.rejects(client.request(BASE_URL), (error) => error instanceof CircuitOpenError);
});
