import fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { securityMiddleware } from '../../src/security/rate';

describe('security middleware', () => {
  it('enforces rate limiting per key', async () => {
    const app = fastify();
    app.register(securityMiddleware, {
      rateLimit: {
        max: 2,
        timeWindow: 1_000,
        keyGenerator: () => 'test-client',
      },
    });

    app.get('/limited', async () => ({ status: 'ok' }));

    await app.ready();

    const first = await app.inject({ method: 'GET', url: '/limited' });
    const second = await app.inject({ method: 'GET', url: '/limited' });
    const third = await app.inject({ method: 'GET', url: '/limited' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);

    await app.close();
  });

  it('caches responses when idempotency key is reused', async () => {
    const app = fastify();
    let counter = 0;

    app.register(securityMiddleware, {
      idempotency: {
        enabled: true,
        storageTtlMs: 5_000,
      },
    });

    app.post('/resource', async () => {
      counter += 1;
      return { counter };
    });

    await app.ready();

    const key = 'operation-1';
    const first = await app.inject({
      method: 'POST',
      url: '/resource',
      headers: { 'Idempotency-Key': key },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/resource',
      headers: { 'Idempotency-Key': key },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(counter).toBe(1);
    expect(second.headers()['idempotent-replay']).toBe('true');
    expect(second.json()).toEqual(first.json());

    await app.close();
  });
});
