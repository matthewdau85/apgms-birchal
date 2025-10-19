import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { createHash } from 'crypto';

export const idempotencyPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('preHandler', async (req, reply) => {
    const method = (req.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

    const key = (req.headers['idempotency-key'] as string | undefined)?.trim();
    const bodyHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');
    // @ts-ignore
    const orgId = (req as any).orgId || 'anon';
    const idem = key || bodyHash;
    (req as any).__idemKey = idem;
    (req as any).__idemCacheKey = `idem:${orgId}:${req.routerPath || req.url}:${idem}`;

    if (app.redis) {
      const cached = await app.redis.get((req as any).__idemCacheKey);
      if (cached) {
        reply.header('Idempotent-Replay', 'true');
        return reply.code(200).send(JSON.parse(cached));
      }
    }
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const method = (req.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return payload;
    if (reply.statusCode >= 200 && reply.statusCode < 300 && (req as any).__idemCacheKey && app.redis) {
      try {
        const value = typeof payload === 'string' ? payload : JSON.stringify(payload);
        await app.redis!.set((req as any).__idemCacheKey, value, 'EX', 3600);
      } catch {}
    }
    return payload;
  });
});

export default idempotencyPlugin;
