import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import { reportsRoutes } from '../src/routes/v1/reports';
import redisPlugin from '../src/plugins/redis';

let app: any;

beforeAll(async () => {
  app = fastify({ logger: false });
  await app.register(redisPlugin);
  await app.register(reportsRoutes);
  await app.ready();
});

afterAll(async () => { await app.close(); });

describe('idempotency', () => {
  it('replays when same Idempotency-Key is used', async () => {
    const headers = { 'idempotency-key': 'abc123' };
    const body = { reportType: 'PAYMENT_HISTORY', startDate: '2024-01-01', endDate: '2024-01-31' };

    const res1 = await app.inject({ method: 'POST', url: '/dashboard/generate-report', payload: body, headers });
    const id1 = res1.json().reportId;

    const res2 = await app.inject({ method: 'POST', url: '/dashboard/generate-report', payload: body, headers });
    expect(res2.headers['idempotent-replay']).toBe('true');
    expect(res2.json().reportId).toBe(id1);
  });
});
