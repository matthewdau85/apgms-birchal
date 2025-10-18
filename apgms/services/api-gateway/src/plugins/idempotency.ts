import crypto from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

const IDEMPOTENCY_PREFIX = "idempotency";

export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface IdempotencyPluginOptions {
  redis: IdempotencyStore;
  ttlSeconds?: number;
}

type StoredResponse = {
  hash: string;
  statusCode: number;
  payload: string;
  payloadEncoding: "string" | "base64";
  headers: Record<string, string>;
};

const kIdempotencyContext = Symbol("idempotency-context");

type IdempotencyContext = {
  redisKey: string;
  payloadHash: string;
};

function computePayloadHash(body: unknown): string {
  const serialized = JSON.stringify(body ?? null);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function buildRedisKey(key: string): string {
  return `${IDEMPOTENCY_PREFIX}:${key}`;
}

function routeKeyFromOptions(method: string, url?: string): string | null {
  if (!url) {
    return null;
  }
  return `${method.toUpperCase()}:${url}`;
}

function getRequestRouteKey(request: FastifyRequest): string | null {
  const url = ((request as unknown as { routeOptions?: { url?: string } }).routeOptions?.url) ?? request.routerPath;
  if (!url) {
    return null;
  }
  return `${request.method.toUpperCase()}:${url}`;
}

function isIdempotentRequest(request: FastifyRequest, lookup: Set<string>): boolean {
  const key = getRequestRouteKey(request);
  if (!key) {
    return false;
  }
  return lookup.has(key);
}

function decodeStoredPayload(stored: StoredResponse): string | Buffer {
  if (stored.payloadEncoding === "base64") {
    return Buffer.from(stored.payload, "base64");
  }
  return stored.payload;
}

async function sendCachedReply(reply: FastifyReply, stored: StoredResponse) {
  for (const [name, value] of Object.entries(stored.headers)) {
    reply.header(name, value);
  }
  reply.code(stored.statusCode);
  return reply.send(decodeStoredPayload(stored));
}

async function persistResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
  context: IdempotencyContext,
  redis: IdempotencyPluginOptions["redis"],
  ttlSeconds: number,
) {
  if (reply.statusCode !== 200 && reply.statusCode !== 201) {
    return;
  }

  const headerEntries = Object.entries(reply.getHeaders() ?? {}).reduce<Record<string, string>>(
    (acc, [name, value]) => {
      if (typeof value === "string") {
        acc[name] = value;
      } else if (typeof value === "number") {
        acc[name] = String(value);
      } else if (Array.isArray(value)) {
        acc[name] = value.join(", ");
      }
      return acc;
    },
    {},
  );

  let storedPayload: string;
  let encoding: StoredResponse["payloadEncoding"] = "string";
  if (Buffer.isBuffer(payload)) {
    storedPayload = payload.toString("base64");
    encoding = "base64";
  } else if (typeof payload === "string") {
    storedPayload = payload;
  } else {
    storedPayload = JSON.stringify(payload);
  }

  const record: StoredResponse = {
    hash: context.payloadHash,
    statusCode: reply.statusCode,
    payload: storedPayload,
    payloadEncoding: encoding,
    headers: headerEntries,
  };

  const redisValue = JSON.stringify(record);
  if (ttlSeconds > 0) {
    await redis.set(context.redisKey, redisValue, "EX", ttlSeconds);
  } else {
    await redis.set(context.redisKey, redisValue);
  }
}

function ensureHeaderKey(rawKey: unknown): string | null {
  if (typeof rawKey !== "string") {
    return null;
  }
  const trimmed = rawKey.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function handleCachedRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  redis: IdempotencyPluginOptions["redis"],
  redisKey: string,
  payloadHash: string,
) {
  const cached = await redis.get(redisKey);
  if (!cached) {
    return null;
  }

  let stored: StoredResponse;
  try {
    stored = JSON.parse(cached) as StoredResponse;
  } catch (error) {
    request.log.error({ error }, "failed to parse idempotency cache; purging entry");
    await redis.del(redisKey);
    return null;
  }

  if (stored.hash !== payloadHash) {
    reply.code(400);
    await reply.send({ error: "idempotency_key_conflict" });
    return reply;
  }

  await sendCachedReply(reply, stored);
  return reply;
}

const idempotencyPlugin: FastifyPluginAsync<IdempotencyPluginOptions> = async (
  fastify,
  options,
) => {
  const { redis, ttlSeconds = 60 * 60 * 24 } = options;
  const idempotentRoutes = new Set<string>();

  fastify.addHook("onRoute", (routeOptions) => {
    const config = (routeOptions.config as { idempotency?: boolean } | undefined)?.idempotency;
    if (!config) {
      return;
    }
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
    const normalizedMethods = (methods ?? []).map((method) =>
      typeof method === "string" ? method.toUpperCase() : String(method).toUpperCase(),
    );
    if (!normalizedMethods.includes("POST")) {
      return;
    }
    const key = routeKeyFromOptions("POST", routeOptions.url ?? routeOptions.path);
    if (key) {
      idempotentRoutes.add(key);
    }
  });

  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") {
      return;
    }
    if (!isIdempotentRequest(request, idempotentRoutes)) {
      return;
    }

    const key = ensureHeaderKey(request.headers["idempotency-key"]);
    if (!key) {
      reply.code(400);
      await reply.send({ error: "missing_idempotency_key" });
      return reply;
    }

    const payloadHash = computePayloadHash(request.body);
    const redisKey = buildRedisKey(key);
    const cachedReply = await handleCachedRequest(request, reply, redis, redisKey, payloadHash);
    if (cachedReply) {
      return cachedReply;
    }

    (request as any)[kIdempotencyContext] = { redisKey, payloadHash } satisfies IdempotencyContext;
    return;
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "POST") {
      return payload;
    }
    if (!isIdempotentRequest(request, idempotentRoutes)) {
      return payload;
    }

    const context = (request as any)[kIdempotencyContext] as IdempotencyContext | undefined;
    if (!context) {
      return payload;
    }

    try {
      await persistResponse(request, reply, payload, context, redis, ttlSeconds);
    } catch (error) {
      request.log.error({ error }, "failed to persist idempotent response");
    }

    return payload;
  });
};

export default idempotencyPlugin;

declare module "fastify" {
  interface FastifyRouteConfig {
    idempotency?: boolean;
  }
}
