import type { preHandlerHookHandler } from "fastify";

export const orgScopeHook: preHandlerHookHandler = async (request, reply) => {
  const user = (request as any).user as { orgId?: string } | undefined;

  if (!user || !user.orgId) {
    await reply.code(401).send({ code: "UNAUTHENTICATED" });
    return reply;
  }

  (request as any).orgId = user.orgId;

  const params = (request.params ?? {}) as Record<string, unknown>;
  const paramOrgId = typeof params.orgId === "string" ? params.orgId : undefined;

  if (paramOrgId && paramOrgId !== user.orgId) {
    await reply.code(403).send({ code: "FORBIDDEN" });
    return reply;
  }
};
