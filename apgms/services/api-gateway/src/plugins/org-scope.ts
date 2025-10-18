import type { FastifyReply, FastifyRequest } from "fastify";

function resolveOrgId(request: FastifyRequest): string | undefined {
  const fromQuery = (request.query as Record<string, unknown> | undefined)?.orgId;
  if (typeof fromQuery === "string") {
    return fromQuery;
  }

  const body = request.body as Record<string, unknown> | undefined;
  const fromBody = body?.orgId;
  if (typeof fromBody === "string") {
    return fromBody;
  }

  const fromParams = (request.params as Record<string, unknown> | undefined)?.orgId;
  if (typeof fromParams === "string") {
    return fromParams;
  }

  return undefined;
}

export function ensureOrgScope() {
  return async function enforce(request: FastifyRequest, reply: FastifyReply) {
    const expectedOrgId = request.user?.orgId;
    const scopedOrgId = resolveOrgId(request);

    if (!expectedOrgId || !scopedOrgId || scopedOrgId !== expectedOrgId) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}
