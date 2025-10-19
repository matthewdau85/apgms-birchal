import { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => reply.send({ ok: true }));

  app.get("/ready", async (_req, reply) => {
    const redisOk = app.hasDecorator("redis") ? "ok" : "na";
    // TODO: also check DB if present
    if (redisOk === "ok") {
      return reply.send({ ready: true });
    }

    return reply.code(503).send({ ready: false });
  });
}
