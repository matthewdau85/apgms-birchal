import type { preHandlerHookHandler } from "fastify";

export const orgScopeHook: preHandlerHookHandler = async (request, reply) => {
  const user = request.user;

  if (!user) {
    return reply.code(401).send({ code: "UNAUTHENTICATED" });
  }

  request.orgId = user.orgId;

  const params = request.params as { orgId?: string };
  if (params?.orgId && params.orgId !== user.orgId) {
    return reply.code(403).send({ code: "FORBIDDEN" });
  }
};
