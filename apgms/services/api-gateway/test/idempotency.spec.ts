import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import idempotencyPlugin from '../src/plugins/idempotency';

let app: any;

beforeAll(async () => {
  app = fastify({ logger: false });
  // mock redis
  const store = new Map<string, string>();
  (app as any).redis = {
    async get(k: string) { return store.get(k) ?? null; },
    async set(k: string, v: string) { store.set(k, v); return 'OK'; },
  };
  await app.register(idempotencyPlugin);
  app.post('/test', async (_req, reply) => reply.send({ ok: true, ts: 1 }));
  await app.ready();
});

afterAll(async () => { await app.close(); });

it('replays same idempotency-key with Idempotent-Replay', async () => {
  const key = 'abc123';
  const first = await app.inject({ method: 'POST', url: '/test', headers: { 'idempotency-key': key }, payload: { x: 1 } });
  expect(first.statusCode).toBe(200);
  const second = await app.inject({ method: 'POST', url: '/test', headers: { 'idempotency-key': key }, payload: { x: 1 } });
  expect(second.statusCode).toBe(200);
  expect(second.headers['idempotent-replay']).toBe('true');
  expect(second.json()).toEqual(first.json());
});
