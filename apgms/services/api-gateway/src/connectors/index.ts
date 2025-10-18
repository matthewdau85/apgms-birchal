import { FastifyBaseLogger } from "fastify";
import { AppConfig } from "../config/env";
import { AuditConnector, HttpAuditConnector } from "./auditConnector";

export interface Connectors {
  audit: AuditConnector;
}

export interface ConnectorOverrides {
  audit?: AuditConnector;
}

export const createConnectors = (
  config: AppConfig,
  logger: FastifyBaseLogger,
  overrides: ConnectorOverrides = {},
): Connectors => ({
  audit:
    overrides.audit ??
    new HttpAuditConnector({
      baseUrl: config.auditServiceUrl,
      logger,
    }),
});
