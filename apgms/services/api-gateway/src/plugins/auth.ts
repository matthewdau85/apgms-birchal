import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

type UserContext = {
  userId: string;
  orgId: string;
  roles: string[];
};

type TokenPayload = {
  sub?: string;
  userId?: string;
  orgId?: string;
  org_id?: string;
  org?: string;
  roles?: string[] | string;
  iss?: string;
  aud?: string | string[];
};

declare module "fastify" {
  interface FastifyRequest {
    user?: UserContext;
  }

  interface FastifyInstance {
    verifyBearer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const normalizeRoles = (value: TokenPayload["roles"]): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }

  return [];
};

const decodeJwtPayload = (token: string): TokenPayload => {
  const segments = token.split(".");
  if (segments.length < 2) {
    throw new Error("invalid_jwt");
  }

  const payloadSegment = segments[1];
  const json = Buffer.from(payloadSegment, "base64url").toString("utf8");

  try {
    return JSON.parse(json) as TokenPayload;
  } catch (error) {
    throw new Error("invalid_jwt_payload");
  }
};

const parseBypassToken = (token: string): TokenPayload => {
  if (!token) {
    throw new Error("empty_token");
  }

  // Allow plain JWTs during bypass for convenience
  if (token.includes(".")) {
    return decodeJwtPayload(token);
  }

  // Attempt to parse a base64-encoded JSON payload
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as TokenPayload;
    if (parsed.sub || parsed.userId) {
      return parsed;
    }
  } catch (error) {
    // ignore
  }

  const [userId, orgId, roles = ""] = token.split(":");
  if (!userId || !orgId) {
    throw new Error("invalid_bypass_token");
  }

  return {
    sub: userId,
    orgId,
    roles,
  };
};

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);

  fastify.decorate(
    "verifyBearer",
    async function verifyBearer(request: FastifyRequest, reply: FastifyReply) {
      if (request.user) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        reply.code(401).send({ error: "unauthorized" });
        return;
      }

      const token = authHeader.slice("Bearer ".length).trim();
      const issuer = process.env.AUTH_ISSUER;
      const audience = process.env.AUTH_AUDIENCE;

      try {
        const payload =
          process.env.AUTH_BYPASS === "true"
            ? parseBypassToken(token)
            : decodeJwtPayload(token);

        if (issuer && payload.iss && payload.iss !== issuer) {
          throw new Error("issuer_mismatch");
        }

        if (audience && payload.aud) {
          const audienceList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
          if (!audienceList.includes(audience)) {
            throw new Error("audience_mismatch");
          }
        }

        const userId = (payload.sub ?? payload.userId) as string | undefined;
        const orgId =
          (payload.orgId ?? payload.org_id ??
            (typeof payload.org === "string" ? payload.org : undefined)) as string | undefined;

        if (!userId || !orgId) {
          throw new Error("missing_claims");
        }

        const roles = normalizeRoles(payload.roles);

        request.user = {
          userId,
          orgId,
          roles,
        };
      } catch (error) {
        request.log.warn({ err: error }, "failed to verify bearer token");
        if (!reply.sent) {
          reply.code(401).send({ error: "unauthorized" });
        }
      }
    }
  );

  fastify.decorate("requireRole", (...roles: string[]) => {
    const required = roles.filter(Boolean);

    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        await fastify.verifyBearer(request, reply);
        if (!request.user || reply.sent) {
          return;
        }
      }

      if (required.length === 0) {
        return;
      }

      const userRoles = new Set(request.user.roles ?? []);
      const hasRole = required.some((role) => userRoles.has(role));

      if (!hasRole) {
        reply.code(403).send({ error: "forbidden" });
      }
    };
  });
};

(authPlugin as Record<string | symbol, unknown>)[Symbol.for("skip-override")] = true;

export default authPlugin;
