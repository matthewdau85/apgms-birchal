import type { FastifyPluginAsync } from "fastify";

const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/webhooks/payto",
    {
      config: { webhookVerification: true },
    },
    async (request, reply) => {
      request.log.info({ event: request.body }, "received payto webhook");
      return reply.code(200).send({ ok: true });
    },
  );
};

export default webhookRoutes;
