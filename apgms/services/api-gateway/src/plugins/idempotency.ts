import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { RedisClient } from "../infra/redis.js";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

interface CachedResponse {
  hash: string;
  statusCode: number;
  headers: Record<string, string>;
  payload: string;
  payloadEncoding: "string" | "base64";
}

interface IdempotencyOptions {
  redis: RedisClient;
  ttlSeconds?: number;
}

declare module "fastify" {
  interface FastifyContextConfig {
    idempotency?: boolean;
  }

  interface FastifyRequest {
    idempotencyState?: {
      redisKey: string;
      hash: string;
    };
    idempotencyReplay?: boolean;
  }
}

const canonicalize = (value: unknown): string => {
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") {
      return input;
    }

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    const entries = Object.entries(input as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, val]) => [key, normalize(val)] as const);

    return Object.fromEntries(entries);
  };

  return JSON.stringify(normalize(value));
};

const buildHash = (method: string, path: string, orgId: string, body: unknown): string => {
  const canonicalBody = canonicalize(body ?? {});
  const payload = `${method.toUpperCase()}|${path}|${orgId ?? ""}|${canonicalBody}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
};

const idempotencyPlugin: FastifyPluginAsync<IdempotencyOptions> = async (app, opts) => {
  const redis = opts.redis;
  const ttl = opts.ttlSeconds ?? IDEMPOTENCY_TTL_SECONDS;

  app.addHook("preHandler", async (request, reply) => {
    const routeConfig = (request.routeOptions as any)?.config ?? (request.context as any)?.config ?? {};
    const isEnabled = Boolean((routeConfig as any).idempotency);
    if (!isEnabled) {
      return;
    }

    const keyHeader = request.headers["idempotency-key"];
    if (!keyHeader || Array.isArray(keyHeader)) {
      reply.code(400).send({ error: "missing_idempotency_key" });
      return reply;
    }

    const body = request.body ?? {};
    const orgId = typeof body === "object" && body !== null && "orgId" in body ? String((body as any).orgId ?? "") : "";
    const routePath = request.routerPath ?? request.raw.url ?? "";
    const hash = buildHash(request.method, routePath, orgId, body);
    const redisKey = `idempotency:${keyHeader}`;

    const cachedRaw = await redis.get(redisKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as CachedResponse;
        if (cached.hash === hash) {
          request.idempotencyReplay = true;
          for (const [name, value] of Object.entries(cached.headers ?? {})) {
            reply.header(name, value);
          }
          reply.code(cached.statusCode);
          if (cached.payloadEncoding === "base64") {
            const buffer = Buffer.from(cached.payload, "base64");
            reply.send(buffer);
          } else {
            reply.send(cached.payload);
          }
          return reply;
        }
      } catch (err) {
        request.log.error({ err }, "failed to parse idempotency cache");
      }

      reply.code(400).send({ error: "idempotency_conflict" });
      return reply;
    }

    request.idempotencyState = { redisKey, hash };
    reply.header("etag", `W/"${hash}"`);
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const routeConfig = (request.routeOptions as any)?.config ?? (request.context as any)?.config ?? {};
    const isEnabled = Boolean((routeConfig as any).idempotency);
    if (!isEnabled || request.idempotencyReplay) {
      return payload;
    }

    const state = request.idempotencyState;
    if (!state) {
      return payload;
    }

    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (typeof value === "string") {
        headers[name] = value;
      } else if (Array.isArray(value)) {
        headers[name] = value.join(", ");
      } else if (value !== undefined && value !== null) {
        headers[name] = String(value);
      }
    }

    let serializedPayload = "";
    let payloadEncoding: CachedResponse["payloadEncoding"] = "string";

    if (payload === null || payload === undefined) {
      serializedPayload = "";
    } else if (Buffer.isBuffer(payload)) {
      serializedPayload = payload.toString("base64");
      payloadEncoding = "base64";
    } else if (typeof payload === "string") {
      serializedPayload = payload;
    } else {
      serializedPayload = JSON.stringify(payload);
    }

    const cacheEntry: CachedResponse = {
      hash: state.hash,
      statusCode: reply.statusCode,
      headers,
      payload: serializedPayload,
      payloadEncoding,
    };

    await redis.set(state.redisKey, JSON.stringify(cacheEntry), "EX", ttl);

    return payload;
  });
};

export default idempotencyPlugin;
