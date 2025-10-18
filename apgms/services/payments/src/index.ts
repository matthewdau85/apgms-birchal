import {
  BaseService,
  type PaymentExecutionMessage,
  type PaymentResultMessage,
  type ServiceConfig,
  type ServiceDependencies,
  nowIso,
} from "../../../shared/src/index";

interface PaymentRecord extends PaymentResultMessage {}

export interface PaymentsServiceConfig extends ServiceConfig {
  maxAmount: number;
  supportedCurrencies: string[];
  settlementDelayDays: number;
}

const DEFAULT_CONFIG: PaymentsServiceConfig = {
  serviceName: "payments",
  maxAmount: 1_000_000,
  supportedCurrencies: ["AUD"],
  settlementDelayDays: 0,
};

export class PaymentsService extends BaseService<PaymentsServiceConfig> {
  private readonly ledger = new Map<string, PaymentRecord>();

  constructor(config: Partial<PaymentsServiceConfig>, deps: ServiceDependencies) {
    super({ ...DEFAULT_CONFIG, ...config, serviceName: config.serviceName ?? DEFAULT_CONFIG.serviceName }, deps);

    this.bus.subscribe("payments.execute", async (message) => {
      await this.handleExecution(message as PaymentExecutionMessage);
    });
  }

  getPayments(): PaymentRecord[] {
    return [...this.ledger.values()];
  }

  private async handleExecution(message: PaymentExecutionMessage): Promise<void> {
    const { payment } = message;
    let result: PaymentRecord;

    try {
      const validationError = this.validate(payment);
      if (validationError) {
        result = this.buildResult(message, "FAILED", validationError);
        this.recordFailure("execute", { reason: validationError });
      } else {
        result = this.buildResult(message, "SETTLED");
        this.recordSuccess("execute", { currency: payment.currency });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      result = this.buildResult(message, "FAILED", reason);
      this.recordFailure("execute", { reason });
      this.logError("payment execution failed unexpectedly", { error: error as Error });
    }

    await this.bus.publish(result);

    await this.bus.publish({
      type: "audit.log",
      traceId: message.traceId,
      timestamp: nowIso(),
      actor: this.config.serviceName,
      action: "payment_execution",
      entity: `payment:${message.payment.paymentId}`,
      status: result.status === "SETTLED" ? "SUCCESS" : "FAILURE",
      reason: result.failureReason,
      details: {
        batchId: message.batchId,
        amount: message.payment.amount,
        currency: message.payment.currency,
        beneficiary: message.payment.beneficiary,
      },
    });
  }

  private validate(payment: PaymentExecutionMessage["payment"]): string | undefined {
    if (payment.amount <= 0) {
      return "NON_POSITIVE_AMOUNT";
    }

    if (payment.amount > this.config.maxAmount) {
      return "EXCEEDS_LIMIT";
    }

    if (!this.config.supportedCurrencies.includes(payment.currency)) {
      return "UNSUPPORTED_CURRENCY";
    }

    return undefined;
  }

  private buildResult(
    message: PaymentExecutionMessage,
    status: PaymentResultMessage["status"],
    failureReason?: string,
  ): PaymentRecord {
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + this.config.settlementDelayDays);
    const record: PaymentRecord = {
      type: "payments.result",
      traceId: message.traceId,
      timestamp: nowIso(),
      orgId: message.orgId,
      batchId: message.batchId,
      payment: message.payment,
      status,
      settlementDate: settlementDate.toISOString().split("T")[0],
      failureReason,
    };

    this.ledger.set(`${message.batchId}:${message.payment.paymentId}`, record);
    return record;
  }
}
