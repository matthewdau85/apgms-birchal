import {
  BaseService,
  type PaymentResultMessage,
  type ReconciliationCompletedMessage,
  type ReconciliationStartMessage,
  type RegistryInstruction,
  type ServiceConfig,
  type ServiceDependencies,
  nowIso,
} from "../../../shared/src/index";

interface BatchState {
  orgId: string;
  traceId: string;
  summary: ReconciliationStartMessage["datasetSummary"];
  expected: Map<string, ReconciliationStartMessage["expectedPayments"][number]>;
  pending: Set<string>;
  results: Map<string, PaymentResultMessage>;
}

export interface ReconciliationServiceConfig extends ServiceConfig {
  autoCloseBatches: boolean;
}

const DEFAULT_CONFIG: ReconciliationServiceConfig = {
  serviceName: "reconciliation",
  autoCloseBatches: true,
};

export class ReconciliationService extends BaseService<ReconciliationServiceConfig> {
  private readonly batches = new Map<string, BatchState>();
  private readonly completed = new Map<string, ReconciliationCompletedMessage>();

  constructor(config: Partial<ReconciliationServiceConfig>, deps: ServiceDependencies) {
    super({ ...DEFAULT_CONFIG, ...config, serviceName: config.serviceName ?? DEFAULT_CONFIG.serviceName }, deps);

    this.bus.subscribe("reconciliation.start", async (message) => {
      await this.handleStart(message as ReconciliationStartMessage);
    });

    this.bus.subscribe("payments.result", async (message) => {
      await this.handlePaymentResult(message as PaymentResultMessage);
    });
  }

  getCompletedBatches(): ReconciliationCompletedMessage[] {
    return [...this.completed.values()];
  }

  private async handleStart(message: ReconciliationStartMessage): Promise<void> {
    const expected = new Map(
      message.expectedPayments.map((payment) => [payment.paymentId, payment] as const),
    );
    const state: BatchState = {
      orgId: message.orgId,
      traceId: message.traceId,
      summary: message.datasetSummary,
      expected,
      pending: new Set(expected.keys()),
      results: new Map(),
    };
    this.batches.set(message.batchId, state);
    this.recordSuccess("start", { batchId: message.batchId });
  }

  private async handlePaymentResult(message: PaymentResultMessage): Promise<void> {
    const state = this.batches.get(message.batchId);
    if (!state) {
      this.logWarn("received payment result for unknown batch", {
        batchId: message.batchId,
        paymentId: message.payment.paymentId,
      });
      this.recordFailure("result", { reason: "UNKNOWN_BATCH" });
      return;
    }

    state.results.set(message.payment.paymentId, message);
    if (message.status === "SETTLED") {
      state.pending.delete(message.payment.paymentId);
    }

    if (state.results.size === state.expected.size && this.config.autoCloseBatches) {
      await this.completeBatch(message.batchId, state);
    }
  }

  private async completeBatch(batchId: string, state: BatchState): Promise<void> {
    const settledPayments = [...state.results.values()].filter((result) => result.status === "SETTLED").length;
    const failedPayments = state.results.size - settledPayments;
    const unmatchedPayments = state.pending.size;

    const summary = {
      transactionCount: state.summary.transactionCount,
      totalCredits: state.summary.totalCredits,
      totalDebits: state.summary.totalDebits,
      settledPayments,
      failedPayments,
      unmatchedPayments,
    };

    const completed: ReconciliationCompletedMessage = {
      type: "reconciliation.completed",
      traceId: state.traceId,
      timestamp: nowIso(),
      orgId: state.orgId,
      batchId,
      summary,
      registryInstructions: state.summary.registryInstructions,
      reportingPeriod: state.summary.reportingPeriod,
    };

    this.completed.set(batchId, completed);
    this.recordSuccess("complete", { batchId });

    await this.bus.publish(completed);

    for (const instruction of state.summary.registryInstructions) {
      await this.publishRegistryUpdate(batchId, state, instruction, summary);
    }

    await this.publishSbrReport(batchId, state, summary);
    await this.publishAudit(batchId, state, summary);

    this.batches.delete(batchId);
  }

  private async publishRegistryUpdate(
    batchId: string,
    state: BatchState,
    instruction: RegistryInstruction,
    summary: ReconciliationCompletedMessage["summary"],
  ): Promise<void> {
    await this.bus.publish({
      type: "registries.update",
      traceId: state.traceId,
      timestamp: nowIso(),
      orgId: state.orgId,
      batchId,
      instruction,
      reconciliationSummary: summary,
    });
  }

  private async publishSbrReport(
    batchId: string,
    state: BatchState,
    summary: ReconciliationCompletedMessage["summary"],
  ): Promise<void> {
    await this.bus.publish({
      type: "sbr.submit",
      traceId: state.traceId,
      timestamp: nowIso(),
      orgId: state.orgId,
      batchId,
      reportingPeriod: state.summary.reportingPeriod,
      reconciliationSummary: summary,
    });
  }

  private async publishAudit(
    batchId: string,
    state: BatchState,
    summary: ReconciliationCompletedMessage["summary"],
  ): Promise<void> {
    const unmatched = [...state.pending].map((id) => state.expected.get(id));
    await this.bus.publish({
      type: "audit.log",
      traceId: state.traceId,
      timestamp: nowIso(),
      actor: this.config.serviceName,
      action: "reconciliation_complete",
      entity: `batch:${batchId}`,
      status: summary.unmatchedPayments === 0 ? "SUCCESS" : "FAILURE",
      reason: summary.unmatchedPayments === 0 ? undefined : "UNMATCHED_PAYMENTS",
      details: {
        settledPayments: summary.settledPayments,
        failedPayments: summary.failedPayments,
        unmatchedPayments: summary.unmatchedPayments,
        unmatched,
      },
    });
  }
}
