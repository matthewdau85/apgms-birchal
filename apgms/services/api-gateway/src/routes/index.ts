import { FastifyInstance } from "fastify";
import { Services } from "../services";
import { AppConfig } from "../config/env";
import { registerHealthRoutes } from "./health";
import { registerUserRoutes } from "./users";
import { registerBankLineRoutes } from "./bankLines";

export const registerRoutes = (app: FastifyInstance, services: Services, config: AppConfig) => {
  registerHealthRoutes(app);
  registerUserRoutes(app, services, config);
  registerBankLineRoutes(app, services, config);
};
