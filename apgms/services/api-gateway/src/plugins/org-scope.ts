import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    ensureOrgParam: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const extractOrgId = (request: FastifyRequest): string | undefined => {
  const query = request.query as Record<string, unknown> | undefined;
  if (query && typeof query.orgId === "string") {
    return query.orgId;
  }

  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body.orgId === "string") {
    return body.orgId;
  }

  return undefined;
};

const orgScopePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("ensureOrgParam", () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        await fastify.verifyBearer(request, reply);
        if (!request.user || reply.sent) {
          return;
        }
      }

      const orgId = extractOrgId(request);
      if (!orgId) {
        reply.code(400).send({ error: "org_id_required" });
        return;
      }

      if (request.user.orgId !== orgId) {
        reply.code(403).send({ error: "forbidden" });
      }
    };
  });
};

(orgScopePlugin as Record<string | symbol, unknown>)[Symbol.for("skip-override")] = true;

export default orgScopePlugin;
