import crypto from "node:crypto";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export interface RedisSetOptions {
  EX?: number;
  PX?: number;
  NX?: boolean;
}

export interface RedisLike {
  set(key: string, value: string, options: RedisSetOptions): Promise<"OK" | null>;
}

export interface WebhookSigningOptions {
  secret?: string;
  redis: RedisLike;
  skewSeconds?: number;
  nonceTtlSeconds?: number;
}

export class InMemoryNonceStore implements RedisLike {
  private readonly entries = new Map<string, number>();

  async set(key: string, _value: string, options: RedisSetOptions): Promise<"OK" | null> {
    const now = Date.now();
    this.cleanup(now);

    const ttlMs = options.PX ?? (options.EX ? options.EX * 1000 : 0);
    const expiresAt = ttlMs > 0 ? now + ttlMs : Number.POSITIVE_INFINITY;

    if (options.NX) {
      const existing = this.entries.get(key);
      if (existing !== undefined && existing > now) {
        return null;
      }
    }

    this.entries.set(key, expiresAt);
    return "OK";
  }

  private cleanup(now: number) {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

class WebhookSignatureError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

type VerifyHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

const webhookSigningPlugin: FastifyPluginAsync<WebhookSigningOptions> = async (fastify, opts) => {
  const secret = opts.secret ?? process.env.WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("WEBHOOK_SECRET is not configured");
  }

  const skewSeconds = opts.skewSeconds ?? 300;
  const nonceTtlSeconds = opts.nonceTtlSeconds ?? skewSeconds;

  const ensureRawBody = (request: FastifyRequest, body: string) => {
    (request as FastifyRequest & { rawBody?: string }).rawBody = body;
  };

  fastify.removeContentTypeParser("application/json");
  fastify.removeContentTypeParser("application/*+json");
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body: string, done) => {
      try {
        ensureRawBody(request, body);
        done(null, body.length > 0 ? JSON.parse(body) : {});
      } catch (err) {
        const error = err as Error & { statusCode?: number };
        error.statusCode = 400;
        done(error);
      }
    },
  );

  fastify.addContentTypeParser(
    "application/*+json",
    { parseAs: "string" },
    (request, body: string, done) => {
      try {
        ensureRawBody(request, body);
        done(null, body.length > 0 ? JSON.parse(body) : {});
      } catch (err) {
        const error = err as Error & { statusCode?: number };
        error.statusCode = 400;
        done(error);
      }
    },
  );

  const verify: VerifyHandler = async (request) => {
    const signature = request.headers["x-signature"];
    const timestampHeader = request.headers["x-timestamp"];
    const nonce = request.headers["x-nonce"];

    if (typeof signature !== "string" || typeof timestampHeader !== "string" || typeof nonce !== "string") {
      throw new WebhookSignatureError("missing_headers", 400);
    }

    const timestamp = Date.parse(timestampHeader);
    if (Number.isNaN(timestamp)) {
      throw new WebhookSignatureError("invalid_timestamp", 400);
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > skewSeconds * 1000) {
      throw new WebhookSignatureError("timestamp_out_of_range", 401);
    }

    const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody ?? "";
    const data = `${timestampHeader}.${nonce}.${rawBody}`;
    const expected = crypto.createHmac("sha256", secret).update(data).digest();

    let provided: Buffer;
    try {
      provided = Buffer.from(signature, "hex");
    } catch {
      throw new WebhookSignatureError("invalid_signature_format", 400);
    }

    if (provided.length !== expected.length || !crypto.timingSafeEqual(expected, provided)) {
      throw new WebhookSignatureError("signature_mismatch", 401);
    }

    const key = `webhook:nonce:${nonce}`;
    const result = await opts.redis.set(key, "1", { EX: nonceTtlSeconds, NX: true });
    if (result !== "OK") {
      throw new WebhookSignatureError("nonce_reused", 409);
    }
  };

  fastify.decorate<VerifyHandler>("verifyWebhookSignature", verify);
};

export default webhookSigningPlugin;

declare module "fastify" {
  interface FastifyInstance {
    verifyWebhookSignature: VerifyHandler;
  }

  interface FastifyRequest {
    rawBody?: string;
  }
}
