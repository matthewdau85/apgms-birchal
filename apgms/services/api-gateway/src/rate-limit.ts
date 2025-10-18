import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { sendError } from "./response.js";

interface RateBucket {
  count: number;
  expiresAt: number;
}

const buckets = new Map<string, RateBucket>();

function getBucketKey(request: FastifyRequest) {
  return request.ip || request.hostname || "unknown";
}

export function enforceRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const key = getBucketKey(request);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt <= now) {
    buckets.set(key, {
      count: 1,
      expiresAt: now + config.rateLimitWindowMs,
    });
    return;
  }

  if (existing.count >= config.rateLimitMax) {
    const retryAfter = Math.max(existing.expiresAt - now, 0);
    reply.header("Retry-After", Math.ceil(retryAfter / 1000));
    sendError(reply, 429, "rate_limited", "Too many requests");
    return;
  }

  existing.count += 1;
}
