import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export type AuthenticatedUser = {
  id: string;
  email: string;
  orgId: string;
  roles: string[];
};

type GuardHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;

const normalizeBoolean = (value: string | undefined) => value?.toLowerCase() === "true";

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest<AuthenticatedUser | undefined>("user", undefined);

  fastify.decorate<(...roles: string[]) => GuardHandler>(
    "requireRole",
    (...roles) => async (request, reply) => {
      if (!request.user) {
        reply.code(401).send({ error: "unauthenticated" });
        return;
      }

      if (roles.length === 0) {
        return;
      }

      const userRoles = new Set(request.user.roles.map((role) => role.toLowerCase()));
      const hasRole = roles.some((role) => userRoles.has(role.toLowerCase()));

      if (!hasRole) {
        reply.code(403).send({ error: "forbidden" });
      }
    },
  );

  fastify.decorate<() => GuardHandler>(
    "requireOrgScope",
    () => async (request, reply) => {
      if (!request.user) {
        reply.code(401).send({ error: "unauthenticated" });
        return;
      }

      const userOrgId = request.user.orgId;
      const bodyOrgId = (request.body as Record<string, unknown> | undefined)?.orgId;
      const queryOrgId = (request.query as Record<string, unknown> | undefined)?.orgId;
      const requestOrgId = typeof bodyOrgId === "string" ? bodyOrgId : typeof queryOrgId === "string" ? queryOrgId : undefined;

      if (!requestOrgId) {
        reply.code(400).send({ error: "org_scope_required" });
        return;
      }

      if (userOrgId !== requestOrgId) {
        reply.code(403).send({ error: "forbidden" });
      }
    },
  );

  fastify.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.config?.public) {
      return;
    }

    if (request.user) {
      return;
    }

    if (normalizeBoolean(process.env.AUTH_BYPASS)) {
      const devUser = request.headers["x-dev-user"];
      const devEmail = request.headers["x-dev-email"];
      const devOrg = request.headers["x-dev-org"];
      const devRoles = request.headers["x-dev-roles"];

      if (typeof devUser !== "string" || typeof devOrg !== "string") {
        reply.code(401).send({ error: "unauthenticated" });
        return;
      }

      const roles = typeof devRoles === "string" && devRoles.length > 0 ? devRoles.split(",").map((role) => role.trim()).filter(Boolean) : [];

      request.user = {
        id: devUser,
        email: typeof devEmail === "string" ? devEmail : "",
        orgId: devOrg,
        roles,
      } satisfies AuthenticatedUser;
      return;
    }

    const authorization = request.headers.authorization;
    if (typeof authorization !== "string") {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    try {
      const payload = parseTokenPayload(token);
      const roles = Array.isArray(payload.roles)
        ? payload.roles.map((role) => String(role))
        : typeof payload.roles === "string"
          ? payload.roles.split(",").map((role) => role.trim()).filter(Boolean)
          : [];

      const user: AuthenticatedUser = {
        id: String(payload.sub ?? payload.userId ?? ""),
        email: payload.email ? String(payload.email) : "",
        orgId: String(payload.orgId ?? payload.org_id ?? ""),
        roles,
      };

      if (!user.id || !user.orgId) {
        reply.code(403).send({ error: "forbidden" });
        return;
      }

      request.user = user;
    } catch (error) {
      request.log.warn({ err: error }, "failed to parse auth token");
      reply.code(401).send({ error: "unauthenticated" });
    }
  });
};

const parseTokenPayload = (token: string): Record<string, unknown> => {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("invalid token");
  }

  const payloadSegment = parts[1];
  const decoded = Buffer.from(payloadSegment, "base64url").toString("utf8");
  return JSON.parse(decoded);
};

export default authPlugin;

declare module "fastify" {
  interface FastifyInstance {
    requireRole: (...roles: string[]) => GuardHandler;
    requireOrgScope: () => GuardHandler;
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
  }

  interface FastifyContextConfig {
    public?: boolean;
  }
}
