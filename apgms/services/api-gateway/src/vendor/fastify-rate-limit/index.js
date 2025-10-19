const DEFAULT_MAX = 100;
const DEFAULT_TIME_WINDOW = 60_000;

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{ max?: number; timeWindow?: number; keyGenerator?: (request: import('fastify').FastifyRequest) => string }} opts
 */
export default async function rateLimit(app, opts = {}) {
  const max = Number.isFinite(opts.max) && opts.max > 0 ? Number(opts.max) : DEFAULT_MAX;
  const timeWindow =
    Number.isFinite(opts.timeWindow) && opts.timeWindow > 0
      ? Number(opts.timeWindow)
      : DEFAULT_TIME_WINDOW;
  const keyGenerator = typeof opts.keyGenerator === "function" ? opts.keyGenerator : (request) => request.ip;

  /** @type {Map<string, { count: number; reset: number }>} */
  const hits = new Map();

  app.addHook("onRequest", async (request, reply) => {
    const key = keyGenerator(request) ?? "";
    const now = Date.now();
    const existing = hits.get(key);

    if (!existing || existing.reset <= now) {
      hits.set(key, { count: 1, reset: now + timeWindow });
      setHeaders(reply, max, max - 1, now + timeWindow);
      return;
    }

    if (existing.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((existing.reset - now) / 1000));
      setHeaders(reply, max, 0, existing.reset);
      reply.header("retry-after", retryAfter);
      reply.code(429);
      await reply.send({ error: "Too Many Requests" });
      return reply;
    }

    existing.count += 1;
    setHeaders(reply, max, Math.max(0, max - existing.count), existing.reset);
  });

  app.addHook("onClose", async () => {
    hits.clear();
  });
}

function setHeaders(reply, limit, remaining, resetAt) {
  reply.header("x-ratelimit-limit", String(limit));
  reply.header("x-ratelimit-remaining", String(Math.max(0, remaining)));
  reply.header("x-ratelimit-reset", String(Math.ceil(resetAt / 1000)));
}
