import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

export const redisPlugin: FastifyPluginAsync = fp(async (app) => {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  // Lazy mock for environments without redis client; replace with ioredis/redis if available
  if (!(app as any).redis) {
    (app as any).redis = {
      _m: new Map<string, string>(),
      async get(k: string) { return this._m.get(k) ?? null; },
      async set(k: string, v: string, _ex?: string, _ttl?: number) { this._m.set(k, v); return 'OK'; },
      async ping() { return 'PONG'; }
    };
    app.log.warn({ url }, 'Using in-memory Redis shim. Set REDIS_URL for real redis.');
  }
});

export default redisPlugin;
