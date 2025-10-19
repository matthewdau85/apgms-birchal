import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    enforceOrgScope: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const forbiddenError = () => {
  const err = new Error("Forbidden");
  (err as any).statusCode = 403;
  return err;
};

const unauthorizedError = () => {
  const err = new Error("Unauthorized");
  (err as any).statusCode = 401;
  return err;
};

const orgScopePlugin = async (app: FastifyInstance) => {
  app.decorate("enforceOrgScope", async (request, reply) => {
    if (!request.user?.orgId) {
      reply.code(401);
      throw unauthorizedError();
    }

    const body = request.body as Record<string, unknown> | undefined;

    if (body && typeof body === "object") {
      const bodyOrgId = (body as { orgId?: unknown }).orgId;
      if (typeof bodyOrgId === "string" && bodyOrgId !== request.user.orgId) {
        reply.code(403);
        throw forbiddenError();
      }
    }
  });
};

export default orgScopePlugin;
