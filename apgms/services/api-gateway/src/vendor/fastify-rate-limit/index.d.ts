import type { FastifyInstance, FastifyRequest } from "fastify";

export interface RateLimitOptions {
  max?: number;
  timeWindow?: number;
  keyGenerator?: (request: FastifyRequest) => string;
}

export default function rateLimit(app: FastifyInstance, opts?: RateLimitOptions): Promise<void>;
