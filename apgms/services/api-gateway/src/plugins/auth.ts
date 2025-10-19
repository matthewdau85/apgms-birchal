import type { FastifyInstance } from "fastify";

import { getAuthConfig } from "../config";
import { verifyJwt } from "../utils/jwt";

type TokenPayload = {
  sub?: string;
  id?: string;
  orgId?: string;
  roles?: string[] | string;
};

type UserPayload = {
  id: string;
  orgId: string;
  roles: string[];
};

const parseRoles = (roles: TokenPayload["roles"]): string[] => {
  if (!roles) {
    return [];
  }

  if (Array.isArray(roles)) {
    return roles.map((role) => String(role));
  }

  if (typeof roles === "string") {
    return roles
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }

  return [];
};

const authPlugin = (fastify: FastifyInstance): void => {
  fastify.addHook("onRequest", async (request, reply) => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      await reply.code(401).send({ code: "UNAUTHENTICATED" });
      return reply;
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      await reply.code(401).send({ code: "UNAUTHENTICATED" });
      return reply;
    }

    try {
      const config = getAuthConfig();
      const decoded = verifyJwt(token, config) as TokenPayload;

      const userId = decoded.sub ?? decoded.id;
      const orgId = decoded.orgId;

      if (!userId || !orgId) {
        await reply.code(401).send({ code: "UNAUTHENTICATED" });
        return reply;
      }

      const user: UserPayload = {
        id: userId,
        orgId,
        roles: parseRoles(decoded.roles),
      };

      (request as any).user = user;
    } catch (error) {
      request.log.warn({ error }, "JWT verification failed");
      await reply.code(401).send({ code: "UNAUTHENTICATED" });
      return reply;
    }
  });
};

export { authPlugin };
