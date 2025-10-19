import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import metricsPlugin from '../src/plugins/metrics';
import healthPlugin from '../src/plugins/health';
import tracingPlugin from '../src/plugins/tracing';

let app: any;

beforeAll(async () => {
  app = fastify({ logger: false });

  // mock redis with a ping
  (app as any).redis = { ping: async () => 'PONG' };

  await app.register(tracingPlugin);
  await app.register(metricsPlugin);
  await app.register(healthPlugin);

  // small route to touch metrics/tracing
  app.get('/demo', async (_req, reply) => reply.send({ ok: true }));

  await app.listen({ port: 0 });
});

afterAll(async () => { await app.close(); });

describe('health & readiness', () => {
  it('health returns UP', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('UP');
  });

  it('ready returns UP when redis is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect([200,503]).toContain(res.statusCode);
    const body = res.json();
    // With mocked redis ping, should be UP
    expect(body.checks.redis.status).toBe('UP');
  });
});

describe('metrics', () => {
  it('exposes prometheus metrics with default HELP lines', async () => {
    await app.inject({ method: 'GET', url: '/demo' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.body).toContain('# HELP');
    expect(res.body).toContain('http_requests_total');
    expect(res.body).toContain('http_request_duration_seconds_bucket');
  });
});

describe('tracing', () => {
  it('emits traceparent and x-trace-id headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/demo' });
    expect(res.headers['traceparent']).toBeTruthy();
    expect(res.headers['x-trace-id']).toBeTruthy();
  });

  it('propagates an inbound traceparent', async () => {
    const inbound = '00-11111111111111111111111111111111-2222222222222222-01';
    const res = await app.inject({ method: 'GET', url: '/demo', headers: { traceparent: inbound } });
    expect(res.headers['traceparent']).toMatch(/^00-11111111111111111111111111111111-/);
  });
});
