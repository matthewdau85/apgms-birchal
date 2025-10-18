import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { deserializeEnvelope, type KeyManagementService, serializeEnvelope } from "../../../shared/crypto/kms";

export type Role = "admin" | "operator" | "auditor";

export interface SecurityOptions {
  kms: KeyManagementService;
  roleTokens: Record<Role, string>;
  rateLimit: {
    max: number;
    intervalMs: number;
  };
  csrfTtlMs?: number;
}

interface RateLimitState {
  count: number;
  resetAt: number;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      role: Role;
      token: string;
    };
  }

  interface FastifyInstance {
    requireRole(roles: Role[]): (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireCsrf(): (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    issueCsrfToken(sessionId: string): Promise<string>;
  }
}

const CSRF_HEADER = "x-csrf-token";
const SESSION_HEADER = "x-session-id";

function normalizeRoles(roleTokens: Record<Role, string>): Map<string, Role> {
  const entries = Object.entries(roleTokens) as [Role, string][];
  return new Map(entries.map(([role, token]) => [token, role]));
}

function getAuthToken(request: FastifyRequest): string | null {
  const header = request.headers["authorization"];
  if (typeof header !== "string") {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

async function handleRateLimit(
  state: Map<string, RateLimitState>,
  key: string,
  options: SecurityOptions,
  reply: FastifyReply,
): Promise<boolean> {
  const now = Date.now();
  const existing = state.get(key);
  if (!existing || existing.resetAt <= now) {
    state.set(key, { count: 1, resetAt: now + options.rateLimit.intervalMs });
    return true;
  }
  if (existing.count >= options.rateLimit.max) {
    await reply.code(429).send({ error: "rate_limited" });
    return false;
  }
  existing.count += 1;
  return true;
}

function decodeCsrfToken(token: string) {
  try {
    return deserializeEnvelope(token);
  } catch (err) {
    throw new Error("invalid_csrf_token");
  }
}

async function verifyCsrf(
  kms: KeyManagementService,
  sessionId: string,
  token: string,
  ttlMs: number,
): Promise<boolean> {
  try {
    const envelope = decodeCsrfToken(token);
    const payload = await kms.decrypt(envelope);
    const parsed = JSON.parse(payload) as { sessionId: string; issuedAt: string };
    if (parsed.sessionId !== sessionId) {
      return false;
    }
    const issuedAt = Date.parse(parsed.issuedAt);
    if (Number.isNaN(issuedAt)) {
      return false;
    }
    return Date.now() - issuedAt <= ttlMs;
  } catch {
    return false;
  }
}

export function registerSecurity(app: FastifyInstance, options: SecurityOptions) {
  const tokenToRole = normalizeRoles(options.roleTokens);
  const rateState = new Map<string, RateLimitState>();
  const csrfTtlMs = options.csrfTtlMs ?? 15 * 60 * 1000;

  app.decorate("issueCsrfToken", async (sessionId: string) => {
    const payload = JSON.stringify({ sessionId, issuedAt: new Date().toISOString() });
    const envelope = await options.kms.encrypt(payload);
    return serializeEnvelope(envelope);
  });

  app.decorate("requireRole", (roles: Role[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const auth = req.auth;
      if (!auth || !roles.includes(auth.role)) {
        await reply.code(403).send({ error: "forbidden" });
        return;
      }
    };
  });

  app.decorate("requireCsrf", () => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const sessionId = req.headers[SESSION_HEADER];
      const token = req.headers[CSRF_HEADER];
      if (typeof sessionId !== "string" || typeof token !== "string") {
        await reply.code(403).send({ error: "csrf_required" });
        return;
      }
      const valid = await verifyCsrf(options.kms, sessionId, token, csrfTtlMs);
      if (!valid) {
        await reply.code(403).send({ error: "csrf_invalid" });
        return;
      }
    };
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.raw.url === "/health" && request.method === "GET") {
      return;
    }
    const token = getAuthToken(request);
    if (!token) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const rateKey = token || request.ip;
    const allowed = await handleRateLimit(rateState, rateKey, options, reply);
    if (!allowed) {
      return;
    }
    const role = tokenToRole.get(token);
    if (!role) {
      await reply.code(403).send({ error: "forbidden" });
      return;
    }
    request.auth = { role, token };
  });
}
