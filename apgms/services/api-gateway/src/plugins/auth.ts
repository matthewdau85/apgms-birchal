import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { unauthorized } from "../utils/errors";

export interface AuthenticatedUser {
  id: string;
  email: string;
  orgId: string;
  [key: string]: unknown;
}

interface SessionRecord {
  user: AuthenticatedUser;
  expiresAt: number;
}

interface AuthPluginOptions {
  sessionTTL?: number;
  sessionStore?: Map<string, SessionRecord>;
}

interface TokenPayload {
  sub: string;
  email: string;
  orgId: string;
  exp?: number;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    createSession: (user: AuthenticatedUser) => string;
    destroySession: (sessionId: string) => void;
  }

  interface FastifyRequest {
    user: AuthenticatedUser | null;
    sessionId: string | null;
  }
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable must be configured");
  }

  const sessionTTL = options.sessionTTL ?? 1000 * 60 * 60;
  const sessionStore = options.sessionStore ?? new Map<string, SessionRecord>();

  fastify.decorateRequest("user", null);
  fastify.decorateRequest("sessionId", null);

  fastify.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = extractBearerToken(request);
    if (token) {
      const payload = verifyToken(token, secret);
      request.user = normalizePayload(payload);
      return;
    }

    const sessionTokenHeader = request.headers["x-session-token"];
    if (typeof sessionTokenHeader === "string") {
      const session = sessionStore.get(sessionTokenHeader);
      if (session && session.expiresAt > Date.now()) {
        request.sessionId = sessionTokenHeader;
        request.user = session.user;
        return;
      }
    }

    throw unauthorized();
  });

  fastify.decorate("createSession", (user: AuthenticatedUser) => {
    const sessionId = randomUUID();
    sessionStore.set(sessionId, { user, expiresAt: Date.now() + sessionTTL });
    return sessionId;
  });

  fastify.decorate("destroySession", (sessionId: string) => {
    sessionStore.delete(sessionId);
  });
};

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) {
    return null;
  }

  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return null;
  }

  return value.trim();
}

function verifyToken(token: string, secret: string): TokenPayload {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw unauthorized("Invalid authentication token");
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;
  const header = parseSegment(headerSegment);
  if (header.alg !== "HS256") {
    throw unauthorized("Unsupported token algorithm");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${headerSegment}.${payloadSegment}`)
    .digest();

  const providedSignature = decodeBase64Url(signatureSegment);
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
    throw unauthorized("Invalid authentication token");
  }

  const payload = parseSegment(payloadSegment) as TokenPayload;
  if (!payload.sub || !payload.email || !payload.orgId) {
    throw unauthorized("Invalid authentication token");
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    throw unauthorized("Authentication token expired");
  }

  return payload;
}

function normalizePayload(payload: TokenPayload): AuthenticatedUser {
  return {
    id: payload.sub,
    email: payload.email,
    orgId: payload.orgId,
  };
}

function parseSegment(segment: string): Record<string, any> {
  try {
    const json = Buffer.from(segment, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    throw unauthorized("Invalid authentication token");
  }
}

function decodeBase64Url(segment: string): Buffer {
  try {
    return Buffer.from(segment, "base64url");
  } catch {
    throw unauthorized("Invalid authentication token");
  }
}

export default authPlugin;
