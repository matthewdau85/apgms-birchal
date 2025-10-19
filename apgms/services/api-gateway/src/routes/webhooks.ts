import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { redis, NONCE_PREFIX } from "../redis";

const WINDOW_SECONDS = 300;
const NONCE_TTL_SECONDS = 600;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, canonicalize(val)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries);
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function verifySignature(secret: string, payload: string, signature: string) {
  const hmac = createHmac("sha256", secret);
  const digest = hmac.update(payload).digest();
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== digest.length) {
    return false;
  }
  return timingSafeEqual(provided, digest);
}

export default async function webhooksRoutes(
  app: FastifyInstance,
  opts: { prefix?: string } = {}
) {
  const route = `${opts.prefix ?? ""}/payto`;
  app.post<{ Body: Record<string, unknown> }>(route, async (request, reply) => {
    const signatureHeader = request.headers["x-signature"];
    const nonceHeader = request.headers["x-nonce"];
    const timestampHeader = request.headers["x-timestamp"];

    if (
      !signatureHeader ||
      !nonceHeader ||
      !timestampHeader ||
      Array.isArray(signatureHeader) ||
      Array.isArray(nonceHeader) ||
      Array.isArray(timestampHeader)
    ) {
      reply.code(400);
      return reply.send({ error: "missing_webhook_headers" });
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
      reply.code(400);
      return reply.send({ error: "invalid_timestamp" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > WINDOW_SECONDS) {
      reply.code(409);
      return reply.send({ error: "stale_timestamp" });
    }

    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      request.log.error("WEBHOOK_SECRET not configured");
      reply.code(500);
      return reply.send({ error: "webhook_secret_missing" });
    }

    const canonicalBody = canonicalJson(request.body ?? {});
    const expected = verifySignature(secret, canonicalBody, signatureHeader);
    if (!expected) {
      reply.code(401);
      return reply.send({ error: "invalid_signature" });
    }

    const nonceKey = `${NONCE_PREFIX}${nonceHeader}`;
    try {
      const stored = await redis.set(nonceKey, String(timestamp), "NX", "EX", NONCE_TTL_SECONDS);
      if (stored !== "OK") {
        reply.code(409);
        return reply.send({ error: "replayed_nonce" });
      }
    } catch (err) {
      request.log.error({ err }, "failed to store nonce");
      reply.code(500);
      return reply.send({ error: "nonce_storage_failed" });
    }

    reply.code(202);
    return reply.send({ status: "accepted" });
  });
}
