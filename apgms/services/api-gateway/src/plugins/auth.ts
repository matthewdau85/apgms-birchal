import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

interface AuthenticatedUser {
  sub: string;
  email?: string;
  orgId?: string;
  roles: string[];
}

type GuardHook = (req: FastifyRequest, rep: FastifyReply) => Promise<void | FastifyReply>;

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }

  interface FastifyInstance {
    requireRole: (...roles: string[]) => GuardHook;
    requireOrgMatch: () => GuardHook;
  }
}

const buildUnauthorizedResponse = (reply: FastifyReply) => {
  void reply.code(401).send({ error: "unauthenticated" });
};

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("onRequest", async (request, reply) => {
    const authBypassEnabled = process.env.AUTH_BYPASS === "true";

    if (authBypassEnabled) {
      const devSub = request.headers["x-dev-sub"] as string | undefined;
      if (!devSub) {
        buildUnauthorizedResponse(reply);
        return reply;
      }

      const devEmail = request.headers["x-dev-email"] as string | undefined;
      const devOrgId = request.headers["x-dev-org"] as string | undefined;
      const devRolesHeader = request.headers["x-dev-roles"] as string | undefined;
      const devRoles = devRolesHeader
        ? devRolesHeader
            .split(",")
            .map((role) => role.trim())
            .filter(Boolean)
        : [];

      request.user = {
        sub: devSub,
        email: devEmail,
        orgId: devOrgId,
        roles: devRoles,
      };
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      buildUnauthorizedResponse(reply);
      return reply;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      buildUnauthorizedResponse(reply);
      return reply;
    }

    request.user = {
      sub: token,
      roles: [],
    };
  });

  fastify.decorate(
    "requireRole",
    (...roles: string[]): GuardHook =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
          buildUnauthorizedResponse(reply);
          return reply;
        }

        if (roles.length === 0) {
          return;
        }

        const hasRole = roles.some((role) => request.user?.roles.includes(role));
        if (!hasRole) {
          void reply.code(403).send({ error: "forbidden", reason: "missing_role" });
          return reply;
        }
      },
  );

  fastify.decorate(
    "requireOrgMatch",
    (): GuardHook =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user?.orgId) {
          void reply.code(403).send({ error: "forbidden", reason: "unknown_org" });
          return reply;
        }

        const bodyOrgId = (request.body as Record<string, unknown> | undefined)?.orgId as
          | string
          | undefined;
        const queryOrgId = (request.query as Record<string, unknown> | undefined)?.orgId as
          | string
          | undefined;
        const targetOrgId = bodyOrgId ?? queryOrgId;

        if (!targetOrgId) {
          void reply.code(400).send({ error: "invalid_request", reason: "orgId_required" });
          return reply;
        }

        if (targetOrgId !== request.user.orgId) {
          void reply.code(403).send({ error: "forbidden", reason: "org_mismatch" });
          return reply;
        }
      },
  );
};

export default authPlugin;
