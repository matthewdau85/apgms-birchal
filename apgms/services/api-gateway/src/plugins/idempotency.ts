import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";

const IDEMPOTENCY_HEADER = "idempotency-key";
const IDEMPOTENCY_PREFIX = "idempotency:";
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

interface CachedEntry {
  requestHash: string;
  statusCode: number;
  payload: string;
  headers: Record<string, string>;
}

interface IdempotencyContext {
  cacheKey: string;
  requestHash: string;
}

declare module "fastify" {
  interface FastifyRequest {
    idempotencyContext: IdempotencyContext | null;
  }
}

const serializeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return JSON.stringify(value);
};

const buildRequestHash = (method: string, url: string, body: unknown): string => {
  const hash = createHash("sha256");
  hash.update(method.toUpperCase());
  hash.update("|");
  hash.update(url);
  hash.update("|");
  hash.update(serializeValue(body));
  return hash.digest("hex");
};

const extractHeaders = (reply: FastifyReply): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(reply.getHeaders())) {
    if (typeof value === "string") {
      const lower = name.toLowerCase();
      if (lower === "content-length") {
        continue;
      }
      headers[name] = value;
    }
  }
  return headers;
};

const parseCachedEntry = (raw: string | null): CachedEntry | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CachedEntry;
    if (
      typeof parsed.requestHash === "string" &&
      typeof parsed.statusCode === "number" &&
      typeof parsed.payload === "string" &&
      parsed.headers &&
      typeof parsed.headers === "object"
    ) {
      return parsed;
    }
  } catch {}
  return null;
};

export const applyIdempotency = async (
  app: FastifyInstance,
  redis: Redis,
): Promise<void> => {
  app.decorateRequest("idempotencyContext", null);

  app.addHook("preHandler", async (request, reply) => {
    const header = request.headers[IDEMPOTENCY_HEADER] ?? request.headers[IDEMPOTENCY_HEADER.toLowerCase()];
    if (!header || typeof header !== "string" || header.trim() === "") {
      request.idempotencyContext = null;
      return;
    }
    const cacheKey = `${IDEMPOTENCY_PREFIX}${header}`;
    const requestHash = buildRequestHash(request.method, request.url, request.body);
    request.idempotencyContext = { cacheKey, requestHash };

    const cached = parseCachedEntry(await redis.get(cacheKey));
    if (!cached) {
      return;
    }
    if (cached.requestHash !== requestHash) {
      request.idempotencyContext = null;
      reply.code(409);
      return reply.send({ error: "idempotency_conflict" });
    }
    request.idempotencyContext = null;
    for (const [name, value] of Object.entries(cached.headers)) {
      reply.header(name, value);
    }
    reply.header("x-idempotent-replay", "true");
    reply.code(200);
    return reply.send(cached.payload);
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const context = request.idempotencyContext;
    if (!context) {
      return payload;
    }
    if (reply.statusCode >= 400) {
      return payload;
    }
    const serializedPayload =
      typeof payload === "string"
        ? payload
        : Buffer.isBuffer(payload)
          ? payload.toString("utf8")
          : serializeValue(payload);
    const entry: CachedEntry = {
      requestHash: context.requestHash,
      statusCode: reply.statusCode,
      payload: serializedPayload,
      headers: extractHeaders(reply),
    };
    await redis.set(context.cacheKey, JSON.stringify(entry), "EX", IDEMPOTENCY_TTL_SECONDS, "NX");
    return payload;
  });
};
