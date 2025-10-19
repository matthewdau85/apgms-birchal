import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

type CheckResult = { status: 'UP'|'DOWN'|'SKIPPED'; details?: string };

async function checkRedis(app: any): Promise<CheckResult> {
  if (!app.redis || typeof app.redis.ping !== 'function') return { status: 'SKIPPED' };
  try {
    const pong = await app.redis.ping();
    return (pong && String(pong).toUpperCase().includes('PONG')) ? { status: 'UP' } : { status: 'DOWN', details: String(pong) };
  } catch (e: any) {
    return { status: 'DOWN', details: e?.message || 'redis error' };
  }
}

async function checkDatabase(app: any): Promise<CheckResult> {
  if (!app.prisma) return { status: 'SKIPPED' };
  try {
    if (typeof app.prisma.$queryRaw === 'function') {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'UP' };
    }
    if (typeof app.prisma.$connect === 'function') {
      await app.prisma.$connect();
      if (typeof app.prisma.$disconnect === 'function') await app.prisma.$disconnect();
      return { status: 'UP' };
    }
    return { status: 'SKIPPED' };
  } catch (e: any) {
    return { status: 'DOWN', details: e?.message || 'db error' };
  }
}

export const healthPlugin: FastifyPluginAsync = fp(async (app) => {
  app.get('/health', async (_req, reply) => {
    reply.send({ status: 'UP' });
  });

  app.get('/ready', async (_req, reply) => {
    const redis = await checkRedis(app);
    const db = await checkDatabase(app);
    const components: Record<string, CheckResult> = { redis, database: db };
    const discovered = Object.values(components).filter(c => c.status !== 'SKIPPED');
    const allUp = discovered.length === 0 ? true : discovered.every(c => c.status === 'UP');
    const status = allUp ? 'UP' : 'DOWN';
    const code = allUp ? 200 : 503;
    reply.code(code).send({ status, checks: components, timestamp: new Date().toISOString() });
  });
});

export default healthPlugin;
