import type { FastifyPluginAsync, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    orgId: string;
  }
}

const orgScopePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("orgId", "");

  fastify.addHook("preHandler", async (request, reply) => {
    if (reply.sent) {
      return;
    }

    if (request.method === "OPTIONS") {
      return;
    }

    const url = request.raw.url ?? "";
    if (url.startsWith("/health")) {
      return;
    }

    const user = request.user;
    if (!user?.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    request.orgId = user.orgId;

    const candidateOrgId = getOrgIdFromRequest(request);
    if (candidateOrgId && candidateOrgId !== user.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }
  });
};

const getOrgIdFromRequest = (request: FastifyRequest): string | undefined => {
  const sources: unknown[] = [
    request.params,
    request.body,
    request.query,
    request.headers,
  ];

  for (const source of sources) {
    if (source && typeof source === "object" && "orgId" in source) {
      const value = (source as Record<string, unknown>).orgId;
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  return undefined;
};

export default orgScopePlugin;
