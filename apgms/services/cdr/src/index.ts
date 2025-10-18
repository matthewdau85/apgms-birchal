import {
  BaseService,
  type CdrIngestionMessage,
  type PaymentExecutionMessage,
  type ServiceConfig,
  type ServiceDependencies,
  nowIso,
} from "../../../shared/src/index";

interface IngestionRecord {
  batchId: string;
  orgId: string;
  connectorId: string;
  receivedAt: string;
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
}

export interface CdrServiceConfig extends ServiceConfig {
  minimumTransactions: number;
}

const DEFAULT_CONFIG: CdrServiceConfig = {
  serviceName: "cdr",
  minimumTransactions: 1,
};

export class CdrService extends BaseService<CdrServiceConfig> {
  private readonly ingestions = new Map<string, IngestionRecord>();

  constructor(config: Partial<CdrServiceConfig>, deps: ServiceDependencies) {
    super({ ...DEFAULT_CONFIG, ...config, serviceName: config.serviceName ?? DEFAULT_CONFIG.serviceName }, deps);

    this.bus.subscribe("cdr.ingest", async (message) => {
      await this.handleIngestion(message as CdrIngestionMessage);
    });
  }

  getIngestions(): IngestionRecord[] {
    return [...this.ingestions.values()];
  }

  private async handleIngestion(message: CdrIngestionMessage): Promise<void> {
    try {
      const { dataset } = message;
      const transactionCount = dataset.transactions.length;
      if (transactionCount < this.config.minimumTransactions) {
        await this.publishAudit(message, "FAILURE", "INSUFFICIENT_TRANSACTIONS", {
          transactionCount,
        });
        this.recordFailure("ingest", { connectorId: message.connectorId });
        return;
      }

      const totalCredits = dataset.transactions
        .filter((txn) => txn.type === "credit")
        .reduce((sum, txn) => sum + txn.amount, 0);
      const totalDebits = dataset.transactions
        .filter((txn) => txn.type === "debit")
        .reduce((sum, txn) => sum + txn.amount, 0);

      const record: IngestionRecord = {
        batchId: message.batchId,
        orgId: message.orgId,
        connectorId: message.connectorId,
        receivedAt: message.timestamp,
        transactionCount,
        totalCredits,
        totalDebits,
      };

      this.ingestions.set(message.batchId, record);

      await this.bus.publish({
        type: "reconciliation.start",
        traceId: message.traceId,
        timestamp: nowIso(),
        orgId: message.orgId,
        batchId: message.batchId,
        expectedPayments: dataset.paymentsDue,
        datasetSummary: {
          transactionCount,
          totalCredits,
          totalDebits,
          reportingPeriod: dataset.reportingPeriod,
          registryInstructions: dataset.registryInstructions,
        },
      });

      for (const payment of dataset.paymentsDue) {
        const paymentMessage: PaymentExecutionMessage = {
          type: "payments.execute",
          traceId: message.traceId,
          timestamp: nowIso(),
          orgId: message.orgId,
          batchId: message.batchId,
          payment,
        };
        await this.bus.publish(paymentMessage);
      }

      await this.publishAudit(message, "SUCCESS");
      this.recordSuccess("ingest", { connectorId: message.connectorId });
    } catch (error) {
      this.logError("failed to ingest CDR batch", { error: error as Error });
      await this.publishAudit(message, "FAILURE", "UNEXPECTED_ERROR", {
        error: error instanceof Error ? error.message : "unknown",
      });
      this.recordFailure("ingest", { connectorId: message.connectorId });
    }
  }

  private async publishAudit(
    message: CdrIngestionMessage,
    status: "SUCCESS" | "FAILURE",
    reason?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.bus.publish({
      type: "audit.log",
      traceId: message.traceId,
      timestamp: nowIso(),
      actor: this.config.serviceName,
      action: "cdr_ingestion",
      entity: `batch:${message.batchId}`,
      status,
      reason,
      details: {
        orgId: message.orgId,
        connectorId: message.connectorId,
        transactionCount: message.dataset.transactions.length,
        ...details,
      },
    });
  }
}
