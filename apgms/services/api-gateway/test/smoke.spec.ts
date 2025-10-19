import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';

// Import minimal plugins to ensure mountability
import openapiPlugin from '../src/plugins/openapi';
import metricsPlugin from '../src/plugins/metrics';
import healthPlugin from '../src/plugins/health';
import tracingPlugin from '../src/plugins/tracing';
import redisPlugin from '../src/plugins/redis';
import authPlugin from '../src/plugins/auth';
import { orgScopeHook } from '../src/hooks/org-scope';

let app: any;

beforeAll(async () => {
  app = fastify({ logger: false });
  await app.register(tracingPlugin);
  await app.register(metricsPlugin);
  await app.register(healthPlugin);
  await app.register(redisPlugin);
  await app.register(openapiPlugin);
  await app.register(authPlugin);

  app.register(async (i, _o, d) => {
    i.addHook('preHandler', i.authenticate);
    i.addHook('preHandler', orgScopeHook);
    i.get('/v1/ping', async (_req, reply) => reply.send({ ok: true }));
    d();
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('gateway smoke', () => {
  it('health is UP', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });
  it('openapi exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi || spec.openapiVersion || spec.swagger).toBeTruthy();
  });
});
