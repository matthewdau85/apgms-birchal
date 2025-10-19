import { FastifyPluginAsync } from "fastify";

type RateLimitOptions = {
  max?: number;
  timeWindow?: number | string;
};

const DEFAULT_MAX = 300;
const DEFAULT_WINDOW_MS = 60_000;

function parseWindow(option?: number | string): number {
  if (typeof option === "number" && Number.isFinite(option) && option > 0) {
    return option;
  }

  if (typeof option === "string") {
    const value = option.trim().toLowerCase();
    const match = value.match(/^(\d+)\s*(ms|s|m|h|d|minute|minutes|second|seconds)$/);
    if (match) {
      const amount = Number(match[1]);
      const unit = match[2];
      switch (unit) {
        case "ms":
          return amount;
        case "s":
        case "second":
        case "seconds":
          return amount * 1000;
        case "m":
        case "minute":
        case "minutes":
          return amount * 60_000;
        case "h":
          return amount * 60 * 60_000;
        case "d":
          return amount * 24 * 60 * 60_000;
        default:
          break;
      }
    }
  }

  return DEFAULT_WINDOW_MS;
}

const rateLimit: FastifyPluginAsync<RateLimitOptions> = async (fastify, opts) => {
  const max = Math.max(1, opts?.max ?? DEFAULT_MAX);
  const windowMs = parseWindow(opts?.timeWindow);
  const buckets = new Map<string, { count: number; expiresAt: number }>();

  fastify.addHook("onRequest", async (request, reply) => {
    const identifier = request.ip ?? request.socket?.remoteAddress ?? "global";
    const now = Date.now();
    const entry = buckets.get(identifier);

    if (!entry || entry.expiresAt <= now) {
      buckets.set(identifier, { count: 1, expiresAt: now + windowMs });
      return;
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
      reply.header("retry-after", retryAfterSeconds.toString());
      reply.code(429);
      await reply.send({ error: "too_many_requests" });
      return reply;
    }

    entry.count += 1;
  });

  fastify.addHook("onClose", async () => {
    buckets.clear();
  });
};

export default rateLimit;
