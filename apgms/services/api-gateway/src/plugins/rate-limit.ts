import type { FastifyPluginAsync } from "fastify";

const ONE_MINUTE = 60_000;
const TEN_SECONDS = 10_000;
const MINUTE_LIMIT = 100;
const TEN_SECOND_LIMIT = 10;
const BODY_LIMIT_BYTES = 1024 * 1024;

type Bucket = {
  minuteTokens: number;
  minuteUpdatedAt: number;
  tenSecondTokens: number;
  tenSecondUpdatedAt: number;
};

const refill = (current: number, lastUpdated: number, now: number, windowMs: number, capacity: number) => {
  if (current >= capacity) {
    return { tokens: capacity, updatedAt: now };
  }
  const delta = now - lastUpdated;
  if (delta <= 0) {
    return { tokens: current, updatedAt: lastUpdated };
  }
  const refillAmount = (delta / windowMs) * capacity;
  const nextTokens = Math.min(capacity, current + refillAmount);
  return { tokens: nextTokens, updatedAt: now };
};

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  const buckets = new Map<string, Bucket>();

  fastify.addHook("onRequest", async (req, reply) => {
    const contentLengthHeader = req.headers["content-length"];
    if (contentLengthHeader) {
      const contentLength = Array.isArray(contentLengthHeader)
        ? Number(contentLengthHeader[0])
        : Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > BODY_LIMIT_BYTES) {
        return reply.code(413).send({ error: "payload_too_large" });
      }
    }

    const ip = req.ip;
    const now = Date.now();
    const existing = buckets.get(ip) ?? {
      minuteTokens: MINUTE_LIMIT,
      minuteUpdatedAt: now,
      tenSecondTokens: TEN_SECOND_LIMIT,
      tenSecondUpdatedAt: now,
    };

    const minuteState = refill(existing.minuteTokens, existing.minuteUpdatedAt, now, ONE_MINUTE, MINUTE_LIMIT);
    const tenSecondState = refill(
      existing.tenSecondTokens,
      existing.tenSecondUpdatedAt,
      now,
      TEN_SECONDS,
      TEN_SECOND_LIMIT
    );

    if (minuteState.tokens < 1 || tenSecondState.tokens < 1) {
      buckets.set(ip, {
        minuteTokens: minuteState.tokens,
        minuteUpdatedAt: minuteState.updatedAt,
        tenSecondTokens: tenSecondState.tokens,
        tenSecondUpdatedAt: tenSecondState.updatedAt,
      });
      return reply.code(429).send({ error: "rate_limit_exceeded" });
    }

    buckets.set(ip, {
      minuteTokens: minuteState.tokens - 1,
      minuteUpdatedAt: minuteState.updatedAt,
      tenSecondTokens: tenSecondState.tokens - 1,
      tenSecondUpdatedAt: tenSecondState.updatedAt,
    });
  });
};

export default rateLimitPlugin;
