import {
  BaseService,
  type ConnectorDataset,
  type ConnectorSyncRequestMessage,
  type ServiceConfig,
  type ServiceDependencies,
  nowIso,
} from "../../../shared/src/index";

export interface ConnectorsServiceConfig extends ServiceConfig {
  connectors: Record<string, ConnectorDataset | (() => ConnectorDataset)>;
  defaultReportingPeriod?: string;
}

const DEFAULT_CONFIG: ConnectorsServiceConfig = {
  serviceName: "connectors",
  connectors: {},
  defaultReportingPeriod: new Date().toISOString().slice(0, 7),
};

export class ConnectorsService extends BaseService<ConnectorsServiceConfig> {
  constructor(config: Partial<ConnectorsServiceConfig>, deps: ServiceDependencies) {
    super({ ...DEFAULT_CONFIG, ...config, serviceName: config.serviceName ?? DEFAULT_CONFIG.serviceName }, deps);

    this.bus.subscribe("connectors.sync.request", async (message) => {
      await this.handleSync(message as ConnectorSyncRequestMessage);
    });
  }

  private resolveDataset(connectorId: string): ConnectorDataset | undefined {
    const configured = this.config.connectors[connectorId];
    if (!configured) {
      return undefined;
    }

    const dataset = typeof configured === "function" ? configured() : configured;
    return {
      ...dataset,
      accounts: dataset.accounts.map((account) => ({ ...account })),
      transactions: dataset.transactions.map((txn) => ({ ...txn })),
      paymentsDue: dataset.paymentsDue.map((payment) => ({ ...payment })),
      registryInstructions: dataset.registryInstructions.map((instruction) => ({
        registry: instruction.registry,
        changes: { ...instruction.changes },
      })),
    };
  }

  private async handleSync(message: ConnectorSyncRequestMessage): Promise<void> {
    try {
      const dataset = this.resolveDataset(message.connectorId);
      if (!dataset) {
        await this.publishFailure(message, "UNKNOWN_CONNECTOR", {
          connectorId: message.connectorId,
        });
        return;
      }

      if (dataset.accounts.length === 0 || dataset.transactions.length === 0) {
        await this.publishFailure(message, "EMPTY_DATASET", {
          accounts: dataset.accounts.length,
          transactions: dataset.transactions.length,
        });
        return;
      }

      const batchId = `${message.connectorId}-${message.orgId}-${Date.now()}`;
      const ingestionMessage = {
        type: "cdr.ingest" as const,
        traceId: message.traceId,
        timestamp: nowIso(),
        orgId: message.orgId,
        connectorId: message.connectorId,
        batchId,
        dataset: {
          ...dataset,
          reportingPeriod: dataset.reportingPeriod || this.config.defaultReportingPeriod || new Date().toISOString().slice(0, 7),
        },
      };

      await this.bus.publish(ingestionMessage);
      await this.publishAudit(message, "SUCCESS");
      this.recordSuccess("sync", { connectorId: message.connectorId });
    } catch (error) {
      this.logError("failed to process connector sync", { error: error as Error });
      await this.publishFailure(message, "UNEXPECTED_ERROR", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async publishFailure(
    message: ConnectorSyncRequestMessage,
    reason: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    this.recordFailure("sync", { connectorId: message.connectorId });
    await this.publishAudit(message, "FAILURE", reason, details);
  }

  private async publishAudit(
    message: ConnectorSyncRequestMessage,
    status: "SUCCESS" | "FAILURE",
    reason?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.bus.publish({
      type: "audit.log",
      traceId: message.traceId,
      timestamp: nowIso(),
      actor: this.config.serviceName,
      action: "connector_sync",
      entity: `connector:${message.connectorId}`,
      status,
      reason,
      details: {
        orgId: message.orgId,
        trigger: message.trigger,
        ...details,
      },
    });
  }
}
