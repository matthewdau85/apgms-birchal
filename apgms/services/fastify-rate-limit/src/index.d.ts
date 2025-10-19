import type { FastifyPluginAsync, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: number;
    };
  }
}

declare const rateLimit: FastifyPluginAsync<{
  max?: number;
  timeWindow?: number | string;
  allowList?: string[];
}>;

export default rateLimit;
