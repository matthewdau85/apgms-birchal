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
  process.env.RATE_LIMIT_MAX = '50';
  process.env.RATE_LIMIT_WINDOW = '1 minute';

  app = fastify({ logger: false });
  await app.register(helmet);
  await app.register(requestIdPlugin);
  await app.register(corsAllowlistPlugin);
  await app.register(rateLimit, { max: 50, timeWindow: '1 minute' });
  await app.register(auditPlugin);

  // minimal routes
  app.get('/ping', async (_req, reply) => reply.send({ ok: true }));
  app.post('/mutate', async (_req, reply) => reply.code(201).send({ ok: true }));

  await app.listen({ port: 0 });
});

afterAll(async () => { await app.close(); });

describe('CORS allowlist', () => {
  it('allows allowed origin', async () => {
    const res = await app.inject({ method: 'GET', url: '/ping', headers: { origin: 'https://allowed.example.com' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
  });

  it('blocks disallowed origin', async () => {
    const res = await app.inject({ method: 'GET', url: '/ping', headers: { origin: 'https://evil.example.com' } });
    // fastify-cors will reject preflight/throw error -> 500 here indicates blocked as per our callback; absence of ACAO header also signals block
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request-id', () => {
  it('adds x-request-id when not provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/ping' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a valid inbound x-request-id', async () => {
    const rid = '11111111-1111-4111-8111-111111111111';
    const res = await app.inject({ method: 'GET', url: '/ping', headers: { 'x-request-id': rid } });
    expect(res.headers['x-request-id']).toBe(rid);
  });
});

describe('audit logs for mutation', () => {
  it('records a mutation event', async () => {
    const res = await app.inject({ method: 'POST', url: '/mutate' });
    expect(res.statusCode).toBe(201);
    expect(app.auditSink.length).toBeGreaterThan(0);
    const last = app.auditSink[app.auditSink.length - 1];
    expect(last.method).toBe('POST');
    expect(last.url).toBe('/mutate');
    expect([200,201]).toContain(last.status);
    expect(last.requestId).toBeTruthy();
  });
});
