import type { FastifyPluginAsync } from "fastify";
import { Healthz200, Readyz200, Readyz503 } from "../schemas/health";

const serviceName = process.env.SERVICE_NAME ?? "api-gateway";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        zodResponse: {
          200: Healthz200,
        },
      },
    },
    async () => ({
      ok: true,
      service: serviceName,
    }),
  );

  fastify.get(
    "/ready",
    {
      schema: {
        zodResponse: {
          200: Readyz200,
          503: Readyz503,
        },
      },
    },
    async () => ({
      ready: true,
    }),
  );
};

export default healthRoutes;
