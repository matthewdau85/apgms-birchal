import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";

import authPlugin from "./plugins/auth";
import { registerModules } from "./modules";
import { registerErrorHandling } from "./utils/errors";

export async function createApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, ...options });

  await app.register(cors, { origin: true });
  await authPlugin(app, {});

  registerErrorHandling(app);
  await registerModules(app);

  app.ready(() => {
    // Helpful when running locally but kept quiet in tests when logger is disabled
    if (app.log && typeof app.log.debug === "function") {
      app.log.debug(app.printRoutes());
    }
  });

  return app;
}
