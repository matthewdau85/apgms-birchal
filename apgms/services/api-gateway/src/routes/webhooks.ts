import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";

const HEADER_SIGNATURE = "x-signature";
const HEADER_NONCE = "x-nonce";
const HEADER_TIMESTAMP = "x-timestamp";
const NONCE_PREFIX = "webhook:nonce:";
const WINDOW_SECONDS = 60 * 5;

const canonicalizePayload = (payload: unknown): string => {
  if (payload === null || payload === undefined) {
    return "";
  }
  if (typeof payload === "string") {
    return payload;
  }
  if (Buffer.isBuffer(payload)) {
    return payload.toString("utf8");
  }
  return JSON.stringify(payload);
};

const computeSignature = (secret: string, timestamp: number, nonce: string, payload: unknown): string => {
  const canonical = `${timestamp}.${nonce}.${canonicalizePayload(payload)}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
};

const isValidTimestamp = (timestamp: number): boolean => {
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= WINDOW_SECONDS;
};

export const registerWebhookRoutes = (app: FastifyInstance, redis: Redis): void => {
  app.post("/webhooks/payto", async (request, reply) => {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      request.log.error("WEBHOOK_SECRET missing");
      return reply.code(500).send({ error: "secret_not_configured" });
    }

    const signatureHeader = request.headers[HEADER_SIGNATURE];
    const nonceHeader = request.headers[HEADER_NONCE];
    const timestampHeader = request.headers[HEADER_TIMESTAMP];

    if (typeof signatureHeader !== "string" || signatureHeader.length === 0) {
      return reply.code(401).send({ error: "invalid_signature" });
    }
    if (typeof nonceHeader !== "string" || nonceHeader.length === 0) {
      return reply.code(401).send({ error: "invalid_nonce" });
    }
    if (typeof timestampHeader !== "string" || timestampHeader.length === 0) {
      return reply.code(400).send({ error: "invalid_timestamp" });
    }

    const timestamp = Number.parseInt(timestampHeader, 10);
    if (!isValidTimestamp(timestamp)) {
      return reply.code(400).send({ error: "stale_timestamp" });
    }

    const expectedSignature = computeSignature(secret, timestamp, nonceHeader, request.body);
    let validSignature = false;
    try {
      const provided = Buffer.from(signatureHeader, "hex");
      const expected = Buffer.from(expectedSignature, "hex");
      validSignature = provided.length === expected.length && timingSafeEqual(provided, expected);
    } catch {
      validSignature = false;
    }
    if (!validSignature) {
      return reply.code(401).send({ error: "invalid_signature" });
    }

    const nonceKey = `${NONCE_PREFIX}${nonceHeader}`;
    const setResult = await redis.set(nonceKey, timestamp.toString(), "EX", WINDOW_SECONDS, "NX");
    if (setResult === null) {
      return reply.code(409).send({ error: "nonce_replay" });
    }

    return reply.code(202).send({ accepted: true });
  });
};
