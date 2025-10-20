import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";

type RedisSetMode = "PX" | "EX" | undefined;

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: RedisSetMode, ttl?: number): Promise<unknown>;
};

export interface WebhookPluginOptions {
  /** Secret used to verify webhook signatures. Falls back to WEBHOOK_SECRET env var. */
  secret?: string;
  /** Redis instance used to store consumed nonces. */
  redis: RedisLike;
  /** Allowed clock skew window in milliseconds. Defaults to 5 minutes. */
  windowMs?: number;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const webhookPlugin = async (fastify: FastifyInstance, opts: WebhookPluginOptions) => {
  const secret = opts.secret ?? process.env.WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("WEBHOOK_SECRET is required for webhook verification");
  }

  const windowMs = opts.windowMs ?? FIVE_MINUTES_MS;

  fastify.addHook("preHandler", async (request, reply) => {
    const path = typeof request.url === "string" ? request.url : request.raw.url;
    if (!path || !path.startsWith("/webhooks/")) {
      return;
    }

    const signature = normalizeHeader(request.headers["x-signature"]);
    const nonce = normalizeHeader(request.headers["x-nonce"]);
    const timestampHeader = normalizeHeader(request.headers["x-timestamp"]);

    if (!signature || !nonce || !timestampHeader) {
      reply.code(401);
      return reply.send({ error: "unauthorized" });
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
      reply.code(401);
      return reply.send({ error: "unauthorized" });
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > windowMs) {
      reply.code(409);
      return reply.send({ error: "stale_timestamp" });
    }

    const bodyString = stringifyBody(request.body);
    const expectedSignature = computeSignature(secret, timestampHeader, nonce, bodyString);

    if (!timingSafeEqual(signature, expectedSignature)) {
      reply.code(401);
      return reply.send({ error: "invalid_signature" });
    }

    const nonceKey = `webhook:nonce:${nonce}`;
    const existing = await opts.redis.get(nonceKey);
    if (existing) {
      reply.code(409);
      return reply.send({ error: "nonce_reused" });
    }

    await opts.redis.set(nonceKey, String(timestamp), "PX", windowMs);
  });
};

export default webhookPlugin;

function normalizeHeader(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return null;
}

function stringifyBody(body: unknown): string {
  if (body === undefined) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  if (Buffer.isBuffer(body)) {
    return body.toString("utf8");
  }
  return JSON.stringify(body ?? null);
}

function computeSignature(secret: string, timestamp: string, nonce: string, body: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}
