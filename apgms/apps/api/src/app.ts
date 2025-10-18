import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { dashboardRoutes } from "./routes/dashboard";
import { bankLinesRoutes } from "./routes/bank-lines";
import { designatedAccountsRoutes } from "./routes/designated-accounts";
import { allocationsRoutes } from "./routes/allocations";
import { auditRoutes } from "./routes/audit";

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "validation_error",
        issues: error.issues,
      });
    }

    if ((error as any)?.validation) {
      request.log.warn(error);
      return reply.status(400).send({
        error: "validation_error",
        issues: (error as any).validation,
      });
    }

    const status = (error as any).statusCode ?? 500;
    const message = status >= 500 ? "internal_server_error" : error.message;

    request.log[status >= 500 ? "error" : "warn"](error);
    return reply.status(status).send({ error: message });
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(dashboardRoutes, { prefix: "/dashboard" });
  app.register(bankLinesRoutes, { prefix: "/bank-lines" });
  app.register(designatedAccountsRoutes, { prefix: "/designated-accounts" });
  app.register(allocationsRoutes, { prefix: "/allocations" });
  app.register(auditRoutes, { prefix: "/audit" });

  return app;
};

export const app = buildApp();

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  app
    .listen({ port, host })
    .then((address) => {
      app.log.info({ address }, "api listening");
    })
    .catch((error) => {
      app.log.error(error, "failed to start api");
      process.exit(1);
    });
}
