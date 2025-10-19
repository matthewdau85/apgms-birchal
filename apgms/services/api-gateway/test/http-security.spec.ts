import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import corsAllowlistPlugin from '../src/plugins/cors-allowlist';
import requestIdPlugin from '../src/plugins/request-id';
import auditPlugin from '../src/plugins/audit';

let app: any;

beforeAll(async () => {
  process.env.CORS_ALLOWLIST = 'https://allowed.example.com,http://localhost:3000';
  app = fastify({ logger: false });
  await app.register(helmet);
  await app.register(requestIdPlugin);
  await app.register(corsAllowlistPlugin);
  await app.register(rateLimit, { max: 50, timeWindow: '1 minute' });
  await app.register(auditPlugin);
  app.get('/ping', async (_req, reply) => reply.send({ ok: true }));
  app.post('/mutate', async (_req, reply) => reply.code(201).send({ ok: true }));
  await app.ready();
});

afterAll(async () => { await app.close(); });

it('allows allowed origin', async () => {
  const res = await app.inject({ method: 'GET', url: '/ping', headers: { origin: 'https://allowed.example.com' } });
  expect(res.statusCode).toBe(200);
  expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
});

it('adds x-request-id', async () => {
  const res = await app.inject({ method: 'GET', url: '/ping' });
  expect(res.headers['x-request-id']).toBeTruthy();
});

it('audits mutation', async () => {
  const res = await app.inject({ method: 'POST', url: '/mutate' });
  expect(res.statusCode).toBe(201);
  expect(app.auditSink.length).toBeGreaterThan(0);
});
