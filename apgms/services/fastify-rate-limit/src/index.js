const DEFAULT_MAX = 100;
const DEFAULT_WINDOW_MS = 60_000;

const unitMultipliers = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1_000,
  second: 1_000,
  seconds: 1_000,
  m: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
};

const parseTimeWindow = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+)(?:\s*(ms|milliseconds?|s|seconds?|m|minutes?|h|hours?))?$/i);
    if (match) {
      const amount = Number(match[1]);
      const unit = (match[2] ?? "ms").toLowerCase();
      const multiplier = unitMultipliers[unit] ?? 1;
      return Math.max(amount * multiplier, 1);
    }
  }

  return DEFAULT_WINDOW_MS;
};

const resolveKey = (request) => {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  if (request.ip) {
    return request.ip;
  }
  return request.socket?.remoteAddress ?? "unknown";
};

const rateLimit = async (fastify, opts = {}) => {
  const max = typeof opts.max === "number" && opts.max > 0 ? Math.floor(opts.max) : DEFAULT_MAX;
  const timeWindow = parseTimeWindow(opts.timeWindow);
  const allowList = new Set(opts.allowList ?? []);
  const hits = new Map();

  fastify.decorateRequest("rateLimit", null);

  fastify.addHook("onRequest", async (request, reply) => {
    const key = resolveKey(request);
    if (allowList.has(key)) {
      return;
    }

    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + timeWindow };
      hits.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(max - entry.count, 0);
    request.rateLimit = { limit: max, remaining, reset: entry.expiresAt };

    if (entry.count > max) {
      reply.header("Retry-After", Math.ceil((entry.expiresAt - now) / 1000));
      return reply.code(429).send({ error: "rate_limit_exceeded" });
    }
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    const info = request.rateLimit;
    if (info) {
      reply.header("X-RateLimit-Limit", String(info.limit));
      reply.header("X-RateLimit-Remaining", String(Math.max(info.remaining, 0)));
      reply.header("X-RateLimit-Reset", String(Math.ceil(info.reset / 1000)));
    }
    return payload;
  });
};

export default rateLimit;
