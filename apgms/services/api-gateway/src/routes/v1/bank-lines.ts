import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

export async function bankLinesRoutes(app: FastifyInstance) {
  app.post('/v1/orgs/:orgId/bank-lines', async (req, reply) => {
    // @ts-ignore
    const orgId = (req as any).orgId;
    const id = randomUUID();
    reply.code(201).send({ id, orgId });
  });
}
