import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';

export const requestIdPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    let rid = (req.headers['x-request-id'] as string | undefined)?.trim();
    const uuidV4Re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!rid || !uuidV4Re.test(rid)) rid = randomUUID();
    (req as any).requestId = rid;
    reply.header('x-request-id', rid);
  });
});
export default requestIdPlugin;
