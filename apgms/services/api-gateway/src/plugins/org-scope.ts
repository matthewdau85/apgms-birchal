import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    orgId?: string;
  }

  interface FastifyInstance {
    ensureOrgScope: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function resolveOrgId(request: FastifyRequest): string | null {
  const headers = request.headers as Record<string, unknown>;
  const devOrg = headers["x-dev-org"];
  if (typeof devOrg === "string" && devOrg.length > 0) {
    return devOrg;
  }

  const headerOrg = headers["x-org-id"];
  if (typeof headerOrg === "string" && headerOrg.length > 0) {
    return headerOrg;
  }

  const paramsOrg = (request.params as Record<string, unknown>)?.orgId;
  if (typeof paramsOrg === "string" && paramsOrg.length > 0) {
    return paramsOrg;
  }

  const queryOrg = (request.query as Record<string, unknown>)?.orgId;
  if (typeof queryOrg === "string" && queryOrg.length > 0) {
    return queryOrg;
  }

  const body = request.body as Record<string, unknown> | null | undefined;
  const bodyOrg = body?.orgId;
  if (typeof bodyOrg === "string" && bodyOrg.length > 0) {
    return bodyOrg;
  }

  return null;
}

async function forbidden(reply: FastifyReply) {
  await reply.code(403).send({ error: "forbidden" });
}

async function unauthorized(reply: FastifyReply) {
  await reply.code(401).send({ error: "unauthorized" });
}

const orgScopePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "ensureOrgScope",
    async function ensureOrgScope(request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) {
        await unauthorized(reply);
        return;
      }

      const requestedOrg = resolveOrgId(request) ?? request.user.orgId;
      if (requestedOrg !== request.user.orgId) {
        await forbidden(reply);
        return;
      }

      request.orgId = requestedOrg;
    }
  );
};

export default orgScopePlugin;
