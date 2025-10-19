import crypto from "node:crypto";
import { FastifyPluginAsync } from "fastify";

const NONCE_WINDOW_MS = 5 * 60 * 1000;
const nonceStore = new Map<string, number>();

const cleanupNonces = (now: number) => {
  for (const [nonce, timestamp] of nonceStore.entries()) {
    if (now - timestamp > NONCE_WINDOW_MS) {
      nonceStore.delete(nonce);
    }
  }
};

const safeCompare = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

export const computeSignature = (
  secret: string,
  nonce: string,
  timestamp: string,
  payload: string
): string => {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${nonce}:${timestamp}:${payload}`);
  return hmac.digest("hex");
};

export const stringifyPayload = (body: unknown): string => {
  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body ?? {});
};

const webhooksRoute: FastifyPluginAsync = async (app) => {
  app.post("/webhooks", async (request, reply) => {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      request.log.error("WEBHOOK_SECRET not configured");
      return reply.code(500).send({ error: "server_error" });
    }

    const nonceHeader = request.headers["x-nonce"];
    const timestampHeader = request.headers["x-timestamp"];
    const signatureHeader = request.headers["x-signature"];

    if (typeof nonceHeader !== "string" || nonceHeader.length === 0) {
      return reply.code(400).send({ error: "missing_nonce" });
    }

    if (typeof timestampHeader !== "string" || timestampHeader.length === 0) {
      return reply.code(400).send({ error: "missing_timestamp" });
    }

    if (typeof signatureHeader !== "string" || signatureHeader.length === 0) {
      return reply.code(400).send({ error: "missing_signature" });
    }

    const now = Date.now();
    const requestTimestamp = Number(timestampHeader);
    if (!Number.isFinite(requestTimestamp)) {
      return reply.code(400).send({ error: "invalid_timestamp" });
    }

    const timestampMs = requestTimestamp;
    cleanupNonces(now);

    if (now - timestampMs > NONCE_WINDOW_MS || timestampMs - now > NONCE_WINDOW_MS) {
      return reply.code(400).send({ error: "stale_timestamp" });
    }

    if (nonceStore.has(nonceHeader)) {
      return reply.code(409).send({ error: "replay_detected" });
    }

    const payload = stringifyPayload(request.body);
    const expectedSignature = computeSignature(secret, nonceHeader, timestampHeader, payload);

    if (!safeCompare(expectedSignature, signatureHeader)) {
      return reply.code(401).send({ error: "invalid_signature" });
    }

    nonceStore.set(nonceHeader, timestampMs);

    return reply.code(202).send({ received: true });
  });
};

export const __internal = {
  clearNonces: () => nonceStore.clear(),
};

export default webhooksRoute;
