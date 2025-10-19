import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import metricsPlugin from '../src/plugins/metrics';
import healthPlugin from '../src/plugins/health';
import tracingPlugin from '../src/plugins/tracing';

let app: any;

beforeAll(async () => {
  app = fastify({ logger: false });
  (app as any).redis = { ping: async () => 'PONG' };
  await app.register(tracingPlugin);
  await app.register(metricsPlugin);
  await app.register(healthPlugin);
  app.get('/demo', async (_req, reply) => reply.send({ ok: true }));
  await app.ready();
});

afterAll(async () => { await app.close(); });

it('health returns UP', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  expect(res.statusCode).toBe(200);
  expect(res.json().status).toBe('UP');
});

it('ready checks redis', async () => {
  const res = await app.inject({ method: 'GET', url: '/ready' });
  const body = res.json();
  expect(body.checks.redis.status).toBe('UP');
});

it('exposes Prometheus metrics', async () => {
  await app.inject({ method: 'GET', url: '/demo' });
  const res = await app.inject({ method: 'GET', url: '/metrics' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/plain/);
  expect(res.body).toContain('http_requests_total');
});

it('emits trace headers', async () => {
  const res = await app.inject({ method: 'GET', url: '/demo' });
  expect(res.headers['traceparent']).toBeTruthy();
  expect(res.headers['x-trace-id']).toBeTruthy();
});
