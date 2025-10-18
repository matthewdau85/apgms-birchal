import Fastify, { type FastifyInstance } from "fastify";
import { loadConfig, AppConfig } from "./config/env";
import { registerPlugins } from "./plugins";
import { createConnectors, ConnectorOverrides } from "./connectors";
import { createServices, ServiceOverrides, Services } from "./services";
import { registerRoutes } from "./routes";

export interface BuildAppOptions {
  config?: Partial<AppConfig>;
  connectors?: ConnectorOverrides;
  services?: ServiceOverrides;
}

export interface BuildAppResult {
  app: FastifyInstance;
  config: AppConfig;
  services: Services;
}

const mergeConfig = (base: AppConfig, overrides: Partial<AppConfig> | undefined): AppConfig => ({
  ...base,
  ...overrides,
  requiredRoles: {
    ...base.requiredRoles,
    ...(overrides?.requiredRoles ?? {}),
  },
});

export const buildApp = async (options: BuildAppOptions = {}): Promise<BuildAppResult> => {
  const baseConfig = loadConfig();
  const config = mergeConfig(baseConfig, options.config);

  const app = Fastify({ logger: { level: config.logLevel } });

  const connectors = createConnectors(config, app.log, options.connectors);
  const services = await createServices(connectors, app.log, options.services);

  await registerPlugins(app, config);
  registerRoutes(app, services, config);

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return { app, config, services };
};
