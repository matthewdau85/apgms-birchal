import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { fastifyPlugin } from "../utils/fastify-plugin";

type RequireRole = (...roles: string[]) => (request: FastifyRequest) => Promise<void>;

declare module "fastify" {
  interface FastifyInstance {
    requireRole: RequireRole;
  }
}

const forbiddenError = () => {
  const err = new Error("forbidden");
  (err as any).statusCode = 403;
  return err;
};

const rbacCore: FastifyPluginAsync = async (fastify) => {
  const requireRole: RequireRole = (...roles) => {
    const required = new Set(roles);
    return async (request) => {
      const userRoles = request.user?.roles ?? [];
      if (required.size === 0) {
        return;
      }
      const hasRole = userRoles.some((role) => required.has(role));
      if (!hasRole) {
        throw forbiddenError();
      }
    };
  };

  fastify.decorate<RequireRole>("requireRole", requireRole);
};

const rbacPlugin = fastifyPlugin(rbacCore);

export default rbacPlugin;
