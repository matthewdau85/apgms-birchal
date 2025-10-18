import { FastifyInstance } from "fastify";
import { healthResponseJsonSchema, healthResponseSchema } from "../schemas/health";

export const registerHealthRoutes = (app: FastifyInstance) => {
  app.get(
    "/health",
    {
      config: { public: true },
      schema: {
        response: {
          200: healthResponseJsonSchema,
        },
      },
    },
    async () =>
      healthResponseSchema.parse({
        ok: true,
        service: "api-gateway" as const,
        uptime: process.uptime(),
      }),
  );
};
