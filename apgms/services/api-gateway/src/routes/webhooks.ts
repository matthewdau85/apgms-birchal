import type { FastifyPluginAsync } from "fastify";

const webhooksRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/webhooks/payto",
    {
      preHandler: app.verifyWebhook,
    },
    async () => {
      return { ok: true };
    },
  );
};

export default webhooksRoutes;
