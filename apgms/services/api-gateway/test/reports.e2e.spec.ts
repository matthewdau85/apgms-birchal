import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import openapiPlugin from '../src/plugins/openapi';
import { reportsRoutes } from '../src/routes/v1/reports';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

let app: any;

beforeAll(async () => {
  app = fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(openapiPlugin);
  await app.register(reportsRoutes);
  await app.ready();
});

afterAll(async () => { await app.close(); });

it('rejects invalid body with 422', async () => {
  const res = await app.inject({
    method: 'POST', url: '/dashboard/generate-report',
    payload: { reportType: 'PAYMENT_HISTORY', startDate: 'bad', endDate: 'also-bad' }
  });
  expect(res.statusCode).toBe(422);
});

it('accepts valid body', async () => {
  const res = await app.inject({
    method: 'POST', url: '/dashboard/generate-report',
    payload: { reportType: 'PAYMENT_HISTORY', startDate: '2024-07-01', endDate: '2024-07-31' }
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toHaveProperty('reportId');
});
