import type { FastifyInstance } from "fastify";

export async function registerHealthModule(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));
}
