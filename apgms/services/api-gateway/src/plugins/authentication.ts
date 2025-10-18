import { createHmac, timingSafeEqual } from "node:crypto";
import { FastifyInstance, FastifyReply, FastifyRequest, type FastifyPluginAsync } from "fastify";
import { ServiceError } from "../utils/errors";
import { AuthenticatedUser } from "../types/auth";

export interface AuthPluginOptions {
  jwtSecret: string;
  jwtAudience?: string;
  jwtIssuer?: string;
}

const parseRoles = (roles: unknown): string[] => {
  if (Array.isArray(roles)) {
    return roles.filter((role): role is string => typeof role === "string");
  }
  if (typeof roles === "string") {
    return roles.split(",").map((role) => role.trim()).filter(Boolean);
  }
  return [];
};

const decodeBase64Url = (segment: string) => {
  try {
    return Buffer.from(segment, "base64url").toString("utf8");
  } catch (error) {
    throw new ServiceError("unauthorized", "Malformed token", 401, { error });
  }
};

const verifyJwt = (token: string, options: AuthPluginOptions): Record<string, unknown> => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new ServiceError("unauthorized", "Malformed token", 401);
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = JSON.parse(decodeBase64Url(headerSegment));

  if (header.alg !== "HS256") {
    throw new ServiceError("unauthorized", "Unsupported token algorithm", 401, { alg: header.alg });
  }

  const signingInput = `${headerSegment}.${payloadSegment}`;
  const expectedSignature = createHmac("sha256", options.jwtSecret).update(signingInput).digest();
  const providedSignature = Buffer.from(signatureSegment, "base64url");

  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    throw new ServiceError("unauthorized", "Invalid token signature", 401);
  }

  const payload = JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp === "number" && now >= payload.exp) {
    throw new ServiceError("unauthorized", "Token expired", 401);
  }

  if (typeof payload.nbf === "number" && now < payload.nbf) {
    throw new ServiceError("unauthorized", "Token not yet valid", 401);
  }

  if (options.jwtAudience) {
    const aud = payload.aud;
    const allowed = Array.isArray(aud) ? aud.map(String) : aud ? [String(aud)] : [];
    if (!allowed.includes(options.jwtAudience)) {
      throw new ServiceError("unauthorized", "Token audience mismatch", 401);
    }
  }

  if (options.jwtIssuer && payload.iss !== options.jwtIssuer) {
    throw new ServiceError("unauthorized", "Token issuer mismatch", 401);
  }

  return payload;
};

const authenticate = async (
  request: FastifyRequest,
  _reply: FastifyReply,
  options: AuthPluginOptions,
) => {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new ServiceError("unauthorized", "Missing bearer token", 401);
  }

  const token = header.substring("Bearer ".length);
  try {
    const payload = verifyJwt(token, options);

    const user: AuthenticatedUser = {
      sub: String(payload.sub ?? ""),
      email: typeof payload.email === "string" ? payload.email : undefined,
      orgId: typeof payload.orgId === "string" ? payload.orgId : undefined,
      roles: parseRoles(payload.roles ?? payload.scope),
    };

    if (!user.sub) {
      throw new ServiceError("unauthorized", "Token payload missing subject", 401);
    }

    request.user = user;
  } catch (error) {
    request.log.warn({ err: error }, "JWT verification failed");
    throw new ServiceError("unauthorized", "Invalid or expired token", 401);
  }
};

export const authenticationPlugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  app.decorateRequest("user", null);

  app.decorate(
    "authenticate",
    async function (this: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      if (request.user) {
        return;
      }
      await authenticate(request, reply, options);
    },
  );

  app.decorate(
    "authorize",
    function (this: FastifyInstance, requiredRoles: string[] = []) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        await app.authenticate(request, reply);
        if (!requiredRoles.length) {
          return;
        }
        const userRoles = new Set(request.user?.roles ?? []);
        const hasAllRoles = requiredRoles.every((role) => userRoles.has(role));
        if (!hasAllRoles) {
          throw new ServiceError("forbidden", "Insufficient permissions", 403, { requiredRoles });
        }
      };
    },
  );

  app.addHook("onRequest", async (request, reply) => {
    const isPublic = Boolean((request.routeOptions.config as any)?.public);
    if (isPublic) {
      return;
    }
    await app.authenticate(request, reply);
  });
};

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }

  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    authorize(requiredRoles?: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
