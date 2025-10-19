import type { FastifyPluginAsync } from "fastify";
import { fastifyPlugin } from "../utils/fastify-plugin";

const forbiddenError = () => {
  const err = new Error("forbidden");
  (err as any).statusCode = 403;
  return err;
};

declare module "fastify" {
  interface FastifyRequest {
    guardOrgParam: (resourceOrgId: string | undefined | null) => void;
    prismaOrgFilter: (orgId?: string | null) => { orgId: string };
  }
}

const orgScopeCore: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("guardOrgParam", function guardOrgParam(resourceOrgId) {
    const request = this;
    const requestOrgId = request.orgId;
    const roles = request.user?.roles ?? [];
    const isAdmin = roles.includes("admin");

    if (!resourceOrgId) {
      if (!isAdmin) {
        throw forbiddenError();
      }
      return;
    }

    if (!requestOrgId) {
      throw forbiddenError();
    }

    if (resourceOrgId !== requestOrgId && !isAdmin) {
      throw forbiddenError();
    }
  });

  fastify.decorateRequest("prismaOrgFilter", function prismaOrgFilter(orgId) {
    const scopedOrgId = orgId ?? this.orgId;
    if (!scopedOrgId) {
      throw forbiddenError();
    }
    return { orgId: scopedOrgId };
  });
};

const orgScopePlugin = fastifyPlugin(orgScopeCore);

export default orgScopePlugin;
