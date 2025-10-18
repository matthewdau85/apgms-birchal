import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { FastifyServerOptions } from "fastify";
import { dashboardRoutes } from "./routes/dashboard.js";
import { bankLinesRoutes } from "./routes/bank-lines.js";
import { auditRoutes } from "./routes/audit.js";
import { allocationRoutes } from "./routes/allocations.js";
import { policyRoutes } from "./routes/policies.js";

export async function buildApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    ...options,
  });

  await app.register(cors, { origin: true });

  app.log.info("registering routes");

  await app.register(dashboardRoutes);
  await app.register(bankLinesRoutes);
  await app.register(auditRoutes);
  await app.register(allocationRoutes);
  await app.register(policyRoutes);

  app.addHook("onError", async (request, reply, error) => {
    request.log.error({ err: error }, "request failed");
    if (!reply.sent) {
      reply.code(500).send({ error: "internal_error" });
    }
  });

  return app;
}
