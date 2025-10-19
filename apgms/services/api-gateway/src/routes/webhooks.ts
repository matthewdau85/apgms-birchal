import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

const WINDOW_SECONDS = 300;
const NONCE_PREFIX = "webhook:nonce:";

type WebhookPluginOptions = {
  secret?: string;
};

function toSingleHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function computeSignature(
  secret: string,
  method: string,
  path: string,
  body: string,
  nonce: string,
  timestamp: string,
): string {
  const digest = crypto.createHash("sha256").update(body).digest("hex");
  const payload = [method.toUpperCase(), path, digest, nonce, timestamp].join("|");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

const webhooksPlugin: FastifyPluginAsync<WebhookPluginOptions> = async (fastify, opts) => {
  const secret = opts.secret ?? process.env.PAYTO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("PAYTO_WEBHOOK_SECRET is not configured");
  }

  fastify.post("/webhooks/payto", { config: { idempotency: { enabled: false } } }, async (request, reply) => {
    const signatureHeader = toSingleHeader(request.headers["x-signature"]);
    const nonce = toSingleHeader(request.headers["x-nonce"]);
    const timestampHeader = toSingleHeader(request.headers["x-timestamp"]);

    if (!signatureHeader || !nonce || !timestampHeader) {
      reply.code(401);
      return reply.send({ error: "missing_webhook_headers" });
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
      reply.code(400);
      return reply.send({ error: "invalid_timestamp" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > WINDOW_SECONDS) {
      reply.code(400);
      return reply.send({ error: "stale_timestamp" });
    }

    const nonceKey = `${NONCE_PREFIX}${nonce}`;
    const nonceStored = await fastify.redis.set(nonceKey, timestampHeader, "NX", "EX", WINDOW_SECONDS);
    if (nonceStored !== "OK") {
      reply.code(409);
      return reply.send({ error: "nonce_replay" });
    }

    const body =
      typeof request.body === "string"
        ? request.body
        : request.body
          ? JSON.stringify(request.body)
          : "";

    const expectedSignature = computeSignature(
      secret,
      request.method,
      request.routerPath ?? request.url,
      body,
      nonce,
      timestampHeader,
    );

    let provided: Buffer;
    let expected: Buffer;
    try {
      provided = Buffer.from(signatureHeader, "hex");
      expected = Buffer.from(expectedSignature, "hex");
    } catch {
      reply.code(401);
      return reply.send({ error: "invalid_signature" });
    }

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      reply.code(401);
      return reply.send({ error: "invalid_signature" });
    }

    return reply.send({ ok: true });
  });
};

export default webhooksPlugin;
