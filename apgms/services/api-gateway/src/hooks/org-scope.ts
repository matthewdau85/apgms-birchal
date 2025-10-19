import { FastifyReply, FastifyRequest } from 'fastify';

export async function orgScopeHook(req: FastifyRequest, reply: FastifyReply) {
  // Require auth to have run and set req.user
  const user = (req as any).user;
  if (!user?.orgId) {
    return reply.code(401).send({ code: 'UNAUTHENTICATED' });
  }

  // If route params include orgId, ensure they match
  const params = (req.params ?? {}) as Record<string, string>;
  if (params.orgId && params.orgId !== user.orgId) {
    return reply.code(403).send({ code: 'FORBIDDEN' });
  }

  // Make orgId available downstream
  (req as any).orgId = user.orgId;
}
