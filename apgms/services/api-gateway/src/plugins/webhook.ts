import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { RedisClient } from "../infra/redis.js";

const TIMESTAMP_WINDOW_SECONDS = 300;
const NONCE_TTL_SECONDS = 60 * 60 * 24;

interface WebhookOptions {
  redis: RedisClient;
  secret: string;
  nonceTtlSeconds?: number;
}

declare module "fastify" {
  interface FastifyContextConfig {
    webhookVerification?: boolean;
  }

  interface FastifyRequest {
    rawBody?: string;
  }
}

const webhookPlugin: FastifyPluginAsync<WebhookOptions> = async (app, opts) => {
  const { redis, secret } = opts;
  const nonceTtl = opts.nonceTtlSeconds ?? NONCE_TTL_SECONDS;

  if (!secret) {
    throw new Error("Webhook secret must be provided");
  }

  app.addHook("preHandler", async (request, reply) => {
    const config = (request.routeOptions as any)?.config ?? (request.context as any)?.config;
    if (!config?.webhookVerification) {
      return;
    }

    const signatureHeader = request.headers["x-signature"];
    const nonceHeader = request.headers["x-nonce"];
    const timestampHeader = request.headers["x-timestamp"];

    if (
      !signatureHeader ||
      Array.isArray(signatureHeader) ||
      !nonceHeader ||
      Array.isArray(nonceHeader) ||
      !timestampHeader ||
      Array.isArray(timestampHeader)
    ) {
      reply.code(401).send({ error: "invalid_signature" });
      return reply;
    }

    const timestampMs = Date.parse(timestampHeader);
    if (Number.isNaN(timestampMs)) {
      reply.code(401).send({ error: "invalid_timestamp" });
      return reply;
    }

    const nowMs = Date.now();
    if (Math.abs(nowMs - timestampMs) > TIMESTAMP_WINDOW_SECONDS * 1000) {
      reply.code(409).send({ error: "stale_timestamp" });
      return reply;
    }

    let providedSignature: Buffer;
    try {
      providedSignature = Buffer.from(signatureHeader, "hex");
    } catch {
      reply.code(401).send({ error: "invalid_signature" });
      return reply;
    }

    const rawBody =
      typeof request.rawBody === "string"
        ? request.rawBody
        : request.body === undefined
          ? ""
          : typeof request.body === "string"
            ? request.body
            : JSON.stringify(request.body);

    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${timestampHeader}.${nonceHeader}.${rawBody}`)
      .digest();

    if (providedSignature.length !== computedSignature.length) {
      reply.code(401).send({ error: "invalid_signature" });
      return reply;
    }

    if (!crypto.timingSafeEqual(providedSignature, computedSignature)) {
      reply.code(401).send({ error: "invalid_signature" });
      return reply;
    }

    const nonceKey = `webhook-nonce:${nonceHeader}`;
    const stored = await redis.set(nonceKey, timestampHeader, "NX", "EX", nonceTtl);
    if (stored !== "OK") {
      reply.code(409).send({ error: "nonce_reused" });
      return reply;
    }
  });
};

export default webhookPlugin;
