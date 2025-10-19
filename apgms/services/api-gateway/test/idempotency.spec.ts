import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import request from 'supertest';
import idempotencyPlugin from '../src/plugins/idempotency';
import { bankLinesRoutes } from '../src/routes/v1/bank-lines';

let app: any;

beforeAll(async () => {
  app = fastify({ logger: false });
  await app.register(idempotencyPlugin, { ttlSeconds: 60 });
  await app.register(bankLinesRoutes);
  await app.listen({ port: 0 });
});

afterAll(async () => {
  await app.close();
});

describe('idempotency', () => {
  it('replays the same response on duplicate POST with the same Idempotency-Key', async () => {
    const key = 'test-key-123';
    const body = { accountId: 'acct-1', amount: 100, currency: 'AUD' };

    const r1 = await request(app.server)
      .post('/v1/bank-lines')
      .set('Idempotency-Key', key)
      .send(body);

    expect([200,201]).toContain(r1.status);
    const first = r1.body;
    expect(first).toHaveProperty('id');

    const r2 = await request(app.server)
      .post('/v1/bank-lines')
      .set('Idempotency-Key', key)
      .send(body);

    expect(r2.status).toBe(200);                      // replayed
    expect(r2.headers['idempotent-replay']).toBe('true');
    expect(r2.body).toEqual(first);                   // same payload
  });

  it('creates a new resource with a different Idempotency-Key', async () => {
    const body = { accountId: 'acct-1', amount: 100, currency: 'AUD' };

    const r1 = await request(app.server)
      .post('/v1/bank-lines')
      .set('Idempotency-Key', 'key-A')
      .send(body);

    const r2 = await request(app.server)
      .post('/v1/bank-lines')
      .set('Idempotency-Key', 'key-B')
      .send(body);

    expect(r1.body.id).not.toBe(r2.body.id);
  });
});
