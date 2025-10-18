import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";
import { authenticationPlugin } from "./authentication";
import { metricsPlugin } from "./metrics";
import { registerErrorHandler } from "./error-handler";
import { AppConfig } from "../config/env";

export const registerPlugins = async (app: FastifyInstance, config: AppConfig) => {
  await app.register(cors, { origin: true });
  await metricsPlugin(app);
  await authenticationPlugin(app, {
    jwtSecret: config.jwtSecret,
    jwtAudience: config.jwtAudience,
    jwtIssuer: config.jwtIssuer,
  });
  registerErrorHandler(app);
};
