import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    org: {
      id: string;
    };
  }
}
