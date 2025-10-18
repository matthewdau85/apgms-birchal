import { randomUUID } from "node:crypto";
import type {
  ConnectorDataset,
  PaymentInstruction,
  RegistryInstruction,
  ReconciliationSummary,
} from "./domain";

export interface MessageBase {
  type: MessageType;
  traceId: string;
  timestamp: string;
}

export type MessageType =
  | "audit.log"
  | "connectors.sync.request"
  | "cdr.ingest"
  | "payments.execute"
  | "payments.result"
  | "reconciliation.start"
  | "reconciliation.payment-posted"
  | "reconciliation.completed"
  | "registries.update"
  | "sbr.submit";

export interface AuditLogMessage extends MessageBase {
  type: "audit.log";
  actor: string;
  action: string;
  entity: string;
  status: "SUCCESS" | "FAILURE";
  reason?: string;
  details?: Record<string, unknown>;
}

export interface ConnectorSyncRequestMessage extends MessageBase {
  type: "connectors.sync.request";
  orgId: string;
  connectorId: string;
  trigger: "manual" | "scheduled";
}

export interface CdrIngestionMessage extends MessageBase {
  type: "cdr.ingest";
  orgId: string;
  connectorId: string;
  batchId: string;
  dataset: ConnectorDataset;
}

export interface PaymentExecutionMessage extends MessageBase {
  type: "payments.execute";
  orgId: string;
  batchId: string;
  payment: PaymentInstruction;
}

export interface PaymentResultMessage extends MessageBase {
  type: "payments.result";
  orgId: string;
  batchId: string;
  payment: PaymentInstruction;
  status: "SETTLED" | "FAILED";
  settlementDate: string;
  failureReason?: string;
}

export interface ReconciliationStartMessage extends MessageBase {
  type: "reconciliation.start";
  orgId: string;
  batchId: string;
  expectedPayments: PaymentInstruction[];
  datasetSummary: {
    transactionCount: number;
    totalCredits: number;
    totalDebits: number;
    reportingPeriod: string;
    registryInstructions: RegistryInstruction[];
  };
}

export interface ReconciliationPaymentMessage extends MessageBase {
  type: "reconciliation.payment-posted";
  orgId: string;
  batchId: string;
  result: PaymentResultMessage;
}

export interface ReconciliationCompletedMessage extends MessageBase {
  type: "reconciliation.completed";
  orgId: string;
  batchId: string;
  summary: ReconciliationSummary;
  registryInstructions: RegistryInstruction[];
  reportingPeriod: string;
}

export interface RegistryUpdateMessage extends MessageBase {
  type: "registries.update";
  orgId: string;
  batchId: string;
  instruction: RegistryInstruction;
  reconciliationSummary: ReconciliationSummary;
}

export interface SbrSubmitMessage extends MessageBase {
  type: "sbr.submit";
  orgId: string;
  batchId: string;
  reportingPeriod: string;
  reconciliationSummary: ReconciliationSummary;
}

export type Message =
  | AuditLogMessage
  | ConnectorSyncRequestMessage
  | CdrIngestionMessage
  | PaymentExecutionMessage
  | PaymentResultMessage
  | ReconciliationStartMessage
  | ReconciliationPaymentMessage
  | ReconciliationCompletedMessage
  | RegistryUpdateMessage
  | SbrSubmitMessage;

export type MessageHandler<T extends Message = Message> = (
  message: T,
) => Promise<void> | void;

export class MessageBus {
  private readonly handlers = new Map<MessageType, Set<MessageHandler>>();

  subscribe<T extends Message>(type: T["type"], handler: MessageHandler<T>): () => void {
    const existing = this.handlers.get(type) ?? new Set<MessageHandler>();
    existing.add(handler as MessageHandler);
    this.handlers.set(type, existing);
    return () => existing.delete(handler as MessageHandler);
  }

  async publish<T extends Message>(message: T): Promise<void> {
    const handlers = this.handlers.get(message.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const errors: unknown[] = [];
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `One or more handlers failed for ${message.type}`);
    }
  }
}

export const createTraceId = (): string => randomUUID();

export const nowIso = (): string => new Date().toISOString();
