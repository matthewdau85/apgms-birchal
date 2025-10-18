import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

type AuthToken = {
  sub?: string;
  orgId?: string;
  roles?: string[];
};

type AuthenticatedUser = {
  userId: string;
  orgId: string;
  roles: string[];
};

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }

  interface FastifyInstance {
    verifyBearer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: string | string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const AUTH_BYPASS = () => String(process.env.AUTH_BYPASS ?? "false").toLowerCase() === "true";

function decodeBearer(token: string): AuthToken | null {
  try {
    const payload = Buffer.from(token, "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch (err) {
    return null;
  }
}

async function sendUnauthorized(reply: FastifyReply) {
  await reply.code(401).send({ error: "unauthorized" });
}

async function sendForbidden(reply: FastifyReply) {
  await reply.code(403).send({ error: "forbidden" });
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);

  fastify.decorate(
    "verifyBearer",
    async function verifyBearer(request: FastifyRequest, reply: FastifyReply) {
      if (AUTH_BYPASS()) {
        if (!request.user) {
          request.user = {
            userId: "dev-bypass",
            orgId: (request.headers["x-org-id"] as string | undefined) ?? "dev-org",
            roles: ["admin", "user"],
          };
        }
        return;
      }

      const authorization = request.headers.authorization;
      if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
        await sendUnauthorized(reply);
        return;
      }

      const rawToken = authorization.slice("bearer ".length).trim();
      const decoded = decodeBearer(rawToken);
      if (!decoded?.orgId) {
        await sendUnauthorized(reply);
        return;
      }

      request.user = {
        userId: decoded.sub ?? "user",
        orgId: decoded.orgId,
        roles: decoded.roles ?? [],
      };
    }
  );

  fastify.decorate("requireRole", function requireRole(role: string | string[]) {
    const required = Array.isArray(role) ? role : [role];
    return async function ensureRole(request: FastifyRequest, reply: FastifyReply) {
      const user = request.user;
      if (!user) {
        await sendUnauthorized(reply);
        return;
      }

      const hasRole = user.roles.some((r) => required.includes(r));
      if (!hasRole) {
        await sendForbidden(reply);
      }
    };
  });
};

export default authPlugin;
