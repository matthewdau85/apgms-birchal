import type { FastifyPluginAsync } from "fastify";
import type { AuthPayload } from "../plugins/auth";

declare module "fastify" {
  interface FastifyRequest {
    orgId?: string;
    currentUser?: AuthPayload;
  }
}

const orgScopeHook: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("orgId", undefined);
  fastify.decorateRequest("currentUser", undefined);

  fastify.addHook("preHandler", async (request) => {
    if (request.routeOptions.config?.public) {
      request.currentUser = undefined;
      request.orgId = undefined;
      return;
    }

    const user = request.user as AuthPayload | undefined;
    if (user && typeof user.orgId === "string" && typeof user.userId === "string") {
      request.currentUser = user;
      request.orgId = user.orgId;
    } else {
      request.currentUser = undefined;
      request.orgId = undefined;
    }
  });
};

export default orgScopeHook;
