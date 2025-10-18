import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "./response.js";

const IDEMPOTENCY_HEADER = "idempotency-key";

interface StoredResponse {
  statusCode: number;
  body: unknown;
  bodyHash: string;
  expiresAt: number;
}

const store = new Map<string, StoredResponse>();

const TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}, TTL_MS).unref?.();

function computeBodyHash(body: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(body ?? null))
    .digest("hex");
}

export async function withIdempotency<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<{ statusCode: number; body: T }>
) {
  const rawKey = request.headers[IDEMPOTENCY_HEADER];

  if (!rawKey) {
    sendError(
      reply,
      400,
      "missing_idempotency_key",
      "Idempotency-Key header is required"
    );
    return;
  }

  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  const bodyHash = computeBodyHash(request.body);

  const cached = store.get(key);
  if (cached) {
    if (cached.bodyHash !== bodyHash) {
      sendError(
        reply,
        409,
        "idempotency_conflict",
        "Request payload does not match stored idempotent request"
      );
      return;
    }

    reply.code(cached.statusCode).send(cached.body);
    return;
  }

  const result = await handler();

  store.set(key, {
    statusCode: result.statusCode,
    body: result.body,
    bodyHash,
    expiresAt: Date.now() + TTL_MS,
  });

  reply.code(result.statusCode).send(result.body);
}
