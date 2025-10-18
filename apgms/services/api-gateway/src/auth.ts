import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { sendError } from "./response.js";

const AUTH_HEADER = "x-api-key";

const AUTH_SKIP_PATHS = new Set(["/health"]);

export interface AuthContext {
  keyId: string;
  orgId: string;
  scopes: string[];
}

function resolveAuthHeader(request: FastifyRequest) {
  const raw = request.headers[AUTH_HEADER];
  if (!raw) {
    return null;
  }

  if (Array.isArray(raw)) {
    return raw[0];
  }

  return raw;
}

export function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): AuthContext | null {
  if (shouldSkipAuth(request.routerPath ?? request.url)) {
    return null;
  }

  const header = resolveAuthHeader(request);
  if (!header) {
    sendError(reply, 401, "missing_api_key", "Authentication required");
    return null;
  }

  const [keyId, signature] = header.split(".");

  if (!keyId || !signature) {
    sendError(reply, 401, "invalid_api_key", "Malformed API key header");
    return null;
  }

  const expectedSignature = createHmac("sha256", config.apiSigningSecret)
    .update(keyId)
    .digest("hex");

  const provided = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    sendError(reply, 401, "invalid_api_key", "Invalid API key signature");
    return null;
  }

  const keyRecord = config.apiKeys[keyId];

  if (!keyRecord) {
    sendError(reply, 403, "unknown_api_key", "API key not recognised");
    return null;
  }

  const context: AuthContext = {
    keyId,
    orgId: keyRecord.orgId,
    scopes: keyRecord.scopes ?? [],
  };

  request.auth = context;

  return context;
}

export function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): request is FastifyRequest & { auth: AuthContext } {
  const auth = authenticateRequest(request, reply);
  return Boolean(auth);
}

export function shouldSkipAuth(path?: string) {
  if (!path) {
    return false;
  }

  const candidate = path.split("?")[0];
  return AUTH_SKIP_PATHS.has(path) || AUTH_SKIP_PATHS.has(candidate);
}
