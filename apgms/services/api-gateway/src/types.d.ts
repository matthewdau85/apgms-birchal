import type { JwtClaims } from "./utils/jwt";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: JwtClaims;
    idempotencyKey?: string;
  }

  interface FastifyInstance {
    authenticate(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply): Promise<void>;
  }
}

export {};
