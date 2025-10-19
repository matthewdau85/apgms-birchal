import Fastify from "fastify";
import cors from "@fastify/cors";
import { buildLogger, registerLogging } from "./lib/log";
import { registerOtel } from "./lib/otel";
import registerPayToRoutes from "./routes/payto";
import registerSbrRoutes from "./routes/sbr";
import registerPrivacyRoutes from "./routes/privacy";

export async function buildApp() {
  const app = Fastify({ logger: buildLogger() });

  await app.register(cors, { origin: true });
  registerLogging(app);
  await registerOtel(app);

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));
  app.get("/healthz", async () => ({ ok: true }));

  await app.register(registerPayToRoutes, { prefix: "/payto" });
  await app.register(registerSbrRoutes, { prefix: "/sbr" });
  await app.register(registerPrivacyRoutes, { prefix: "/privacy" });

  app.setErrorHandler((error, request, reply) => {
    if (error.message === "admin_required") {
      return reply.send({ error: "admin_required" });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "internal_error" });
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
