import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export interface AuthenticatedUser {
  id: string;
  email: string;
  orgId: string;
  roles: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

const parseCsv = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const unauthorized = (reply: FastifyReply) =>
  reply.code(401).send({ error: "unauthorized" });

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("onRequest", async (req, reply) => {
    req.user = null;

    if (process.env.AUTH_BYPASS === "true") {
      const headers = req.headers;
      const userId = headers["x-dev-user"];
      const email = headers["x-dev-email"];
      const orgId = headers["x-dev-org"];
      req.user = {
        id: Array.isArray(userId) ? userId[0] ?? "" : String(userId ?? ""),
        email: Array.isArray(email) ? email[0] ?? "" : String(email ?? ""),
        orgId: Array.isArray(orgId) ? orgId[0] ?? "" : String(orgId ?? ""),
        roles: parseCsv(
          Array.isArray(headers["x-dev-roles"]) ? headers["x-dev-roles"][0] : headers["x-dev-roles"]
        ),
      };
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(reply);
    }

    const token = authHeader.substring("Bearer ".length).trim();
    if (!token) {
      return unauthorized(reply);
    }

    const segments = token.split(".");
    if (segments.length < 2) {
      return unauthorized(reply);
    }

    try {
      const payloadJson = Buffer.from(segments[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadJson) as Partial<AuthenticatedUser> & {
        sub?: string;
        roles?: string[] | string;
      };

      const id = typeof payload.id === "string" ? payload.id : payload.sub ?? "";
      const email = typeof payload.email === "string" ? payload.email : "";
      const orgId = typeof payload.orgId === "string" ? payload.orgId : "";
      const rawRoles = Array.isArray(payload.roles)
        ? payload.roles
        : typeof payload.roles === "string"
        ? parseCsv(payload.roles)
        : [];

      if (!id || !email || !orgId) {
        return unauthorized(reply);
      }

      req.user = {
        id,
        email,
        orgId,
        roles: rawRoles,
      };
    } catch {
      return unauthorized(reply);
    }
  });
};

export const requireRole = (...roles: string[]) => {
  const expected = new Set(roles);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    if (!user) {
      return unauthorized(reply);
    }
    if (expected.size === 0) {
      return;
    }
    const hasRole = user.roles.some((role) => expected.has(role));
    if (!hasRole) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
};

export const requireOrgScope = () => {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    if (!user) {
      return unauthorized(reply);
    }

    const bodyOrgId = typeof (req.body as any)?.orgId === "string" ? (req.body as any).orgId : undefined;
    const queryOrgId = typeof (req.query as any)?.orgId === "string" ? (req.query as any).orgId : undefined;
    const targetOrgId = bodyOrgId ?? queryOrgId;

    if (!targetOrgId || targetOrgId !== user.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
};

export default authPlugin;
