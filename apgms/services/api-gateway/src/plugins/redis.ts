import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<any>;
  ping(): Promise<string>;
};

declare module 'fastify' {
  interface FastifyInstance { redis?: RedisLike; }
}

export const redisPlugin: FastifyPluginAsync = fp(async (app) => {
  const url = process.env.REDIS_URL;
  if (!url) return; // optional
  const { createClient } = require('redis');
  const client = createClient({ url });
  client.on('error', (e: any) => app.log.error({ err: e }, 'redis_error'));
  await client.connect();
  app.decorate('redis', client);
  app.addHook('onClose', async () => { try { await client.quit(); } catch {} });
});

export default redisPlugin;
