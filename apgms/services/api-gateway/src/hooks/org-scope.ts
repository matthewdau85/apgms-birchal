import { FastifyReply, FastifyRequest } from "fastify";

export async function orgScopeHook(req: FastifyRequest, reply: FastifyReply) {
  const user = (req as any).user;
  if (!user?.orgId) {
    return reply.code(401).send({ code: "UNAUTHENTICATED" });
  }

  const params = (req.params ?? {}) as Record<string, string>;
  if (params.orgId && params.orgId !== user.orgId) {
    return reply.code(403).send({ code: "FORBIDDEN" });
  }

  (req as any).orgId = user.orgId;
}
