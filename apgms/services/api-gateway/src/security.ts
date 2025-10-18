import type { FastifyInstance } from "fastify";

import { config } from "./config";

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  if (!config.securityLogPath) {
    return;
  }

  app.log.info({ securityLogPath: config.securityLogPath }, "security logging configured");
}
