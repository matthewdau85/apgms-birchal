import type { FastifyPluginAsync } from "fastify";

interface RateLimitBucket {
  minuteStart: number;
  minuteCount: number;
  burstStart: number;
  burstCount: number;
}

const MAX_PER_MINUTE = 100;
const MAX_PER_BURST = 10;
const MINUTE_WINDOW_MS = 60_000;
const BURST_WINDOW_MS = 10_000;

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  const buckets = new Map<string, RateLimitBucket>();

  fastify.addHook("onRequest", async (request, reply) => {
    const clientId = request.ip;

    if (!clientId) {
      return;
    }

    const now = Date.now();
    const bucket = buckets.get(clientId) ?? {
      minuteStart: now,
      minuteCount: 0,
      burstStart: now,
      burstCount: 0,
    };

    if (now - bucket.minuteStart >= MINUTE_WINDOW_MS) {
      bucket.minuteStart = now;
      bucket.minuteCount = 0;
    }

    if (now - bucket.burstStart >= BURST_WINDOW_MS) {
      bucket.burstStart = now;
      bucket.burstCount = 0;
    }

    if (bucket.minuteCount >= MAX_PER_MINUTE || bucket.burstCount >= MAX_PER_BURST) {
      void reply.code(429).send({ error: "rate_limited" });
      return reply;
    }

    bucket.minuteCount += 1;
    bucket.burstCount += 1;

    buckets.set(clientId, bucket);
  });
};

export default rateLimitPlugin;
