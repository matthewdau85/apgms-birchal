import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import openapiPlugin from '../src/plugins/openapi';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { reportsRoutes } from '../src/routes/v1/reports';

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

describe('openapi contract', () => {
  it('exposes /openapi.json with report routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    const paths = Object.keys(spec.paths || {});
    expect(paths).toContain('/dashboard/generate-report');
    expect(paths).toContain('/dashboard/report/{id}/download');
  });
});
