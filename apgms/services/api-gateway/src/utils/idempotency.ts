import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'crypto';

export async function withIdempotency(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  body: unknown
): Promise<string | null> {
  const idemKey = req.headers['idempotency-key'] as string | undefined;
  const bodyHash = createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  const cacheKey = `idem:${orgId}:${idemKey ?? bodyHash}`;
  const redis = (app as any).redis;
  if (!redis) return null;
  const existing = await redis.get(cacheKey);
  if (existing) {
    reply.header('Idempotent-Replay', 'true');
  } else {
    reply.header('Idempotent-Replay', 'false');
  }
  return cacheKey;
}

export async function storeIdempotentResult(app: FastifyInstance, cacheKey: string, value: string) {
  const redis = (app as any).redis;
  if (!redis) return;
  await redis.set(cacheKey, value, 'EX', 3600);
}
