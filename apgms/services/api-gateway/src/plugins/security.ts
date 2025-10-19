import type { FastifyInstance } from "fastify";

const DEV_DEFAULT_RPM = 100;
const PROD_DEFAULT_RPM = 60;
const WINDOW_MS = 60_000;

function resolveDefaultRateLimit(nodeEnv: string) {
  return nodeEnv === "production" ? PROD_DEFAULT_RPM : DEV_DEFAULT_RPM;
}

export function resolveRateLimitRpm(env: NodeJS.ProcessEnv = process.env): number {
  const nodeEnv = env.NODE_ENV?.toLowerCase() ?? "development";
  const configured = env.RATE_LIMIT_RPM;

  if (configured === undefined || configured === "") {
    return resolveDefaultRateLimit(nodeEnv);
  }

  const parsed = Number.parseInt(configured, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid RATE_LIMIT_RPM value: ${configured}`);
  }

  return parsed;
}

class SlidingWindowLimiter {
  #max: number;
  #windowStart = Date.now();
  #count = 0;

  constructor(max: number) {
    this.#max = max;
  }

  tryConsume(now = Date.now()): boolean {
    if (now - this.#windowStart >= WINDOW_MS) {
      this.#windowStart = now;
      this.#count = 0;
    }

    if (this.#count >= this.#max) {
      return false;
    }

    this.#count += 1;
    return true;
  }
}

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  const limiter = new SlidingWindowLimiter(resolveRateLimitRpm());

  app.addHook("onRequest", async (_request, reply) => {
    if (limiter.tryConsume()) {
      return;
    }

    reply.code(429);
    await reply.send({ error: "rate_limit_exceeded" });
    return reply;
  });
}
