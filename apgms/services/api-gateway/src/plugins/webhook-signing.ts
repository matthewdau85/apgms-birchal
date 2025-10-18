import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

type Clock = () => Date;

export interface RedisSetCommand {
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
}

export interface WebhookSigningPluginOptions {
  secret: string;
  redis: RedisSetCommand;
  maxSkewSeconds?: number;
  nonceTtlSeconds?: number;
  clock?: Clock;
  nonceKeyPrefix?: string;
}

export class WebhookVerificationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class WebhookReplayError extends WebhookVerificationError {
  constructor(message = "Nonce has already been used") {
    super(409, "nonce_reused", message);
  }
}

const isHex = (value: string): boolean => /^[0-9a-fA-F]+$/.test(value);

const computeSignature = (secret: string, timestamp: string, nonce: string, rawBody: string): Buffer => {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${nonce}.${rawBody}`);
  return Buffer.from(hmac.digest("hex"), "hex");
};

declare module "fastify" {
  interface FastifyInstance {
    verifyWebhookSignature(request: FastifyRequest, rawBody: string): Promise<void>;
  }
}

export class InMemoryNonceStore implements RedisSetCommand {
  private readonly store = new Map<string, { expiresAt: number }>();

  async set(key: string, _value: string, ...args: unknown[]): Promise<unknown> {
    const mode = args[0];
    const ttlSeconds = args[1] as number | undefined;
    const setMode = args[2];

    if (mode !== "EX" || setMode !== "NX") {
      throw new Error("InMemoryNonceStore only supports SET with EX and NX options");
    }

    if (typeof ttlSeconds !== "number") {
      throw new Error("TTL seconds must be provided when reserving a nonce");
    }

    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.expiresAt > now) {
      return null;
    }

    const expiresAt = now + ttlSeconds * 1000;
    this.store.set(key, { expiresAt });

    const timeout = setTimeout(() => {
      const entry = this.store.get(key);
      if (entry && entry.expiresAt <= Date.now()) {
        this.store.delete(key);
      }
    }, ttlSeconds * 1000);

    if (typeof timeout.unref === "function") {
      timeout.unref();
    }

    return "OK";
  }
}

const webhookSigningPlugin: FastifyPluginAsync<WebhookSigningPluginOptions> = async (app, opts) => {
  const {
    secret,
    redis,
    maxSkewSeconds = 300,
    nonceTtlSeconds = 300,
    clock = () => new Date(),
    nonceKeyPrefix = "webhook:nonce",
  } = opts;

  if (!secret) {
    throw new Error("Webhook signing secret is required");
  }

  if (!redis || typeof redis.set !== "function") {
    throw new Error("A Redis client with a set command is required");
  }

  const verifyWebhookSignature = async (request: FastifyRequest, rawBody: string): Promise<void> => {
    const signatureHeader = request.headers["x-signature"];
    const timestampHeader = request.headers["x-timestamp"];
    const nonceHeader = request.headers["x-nonce"];

    if (typeof signatureHeader !== "string" || signatureHeader.length === 0) {
      throw new WebhookVerificationError(400, "missing_signature", "x-signature header is required");
    }

    if (!isHex(signatureHeader) || signatureHeader.length % 2 !== 0) {
      throw new WebhookVerificationError(401, "invalid_signature", "Signature must be a valid hex string");
    }

    if (typeof timestampHeader !== "string" || timestampHeader.length === 0) {
      throw new WebhookVerificationError(400, "missing_timestamp", "x-timestamp header is required");
    }

    const timestamp = new Date(timestampHeader);
    if (Number.isNaN(timestamp.getTime())) {
      throw new WebhookVerificationError(400, "invalid_timestamp", "x-timestamp must be an ISO timestamp");
    }

    const now = clock();
    const ageMs = Math.abs(now.getTime() - timestamp.getTime());
    if (ageMs > maxSkewSeconds * 1000) {
      throw new WebhookVerificationError(401, "timestamp_out_of_range", "Timestamp is outside the allowed window");
    }

    if (typeof nonceHeader !== "string" || nonceHeader.length === 0) {
      throw new WebhookVerificationError(400, "missing_nonce", "x-nonce header is required");
    }

    const providedSignature = Buffer.from(signatureHeader, "hex");
    const expectedSignature = computeSignature(secret, timestampHeader, nonceHeader, rawBody);

    if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
      throw new WebhookVerificationError(401, "invalid_signature", "Signature verification failed");
    }

    const redisKey = `${nonceKeyPrefix}:${nonceHeader}`;
    const result = (await redis.set(redisKey, timestampHeader, "EX", nonceTtlSeconds, "NX")) as string | null;
    if (result !== "OK") {
      throw new WebhookReplayError();
    }
  };

  app.decorate("verifyWebhookSignature", verifyWebhookSignature);
};

export default webhookSigningPlugin;
