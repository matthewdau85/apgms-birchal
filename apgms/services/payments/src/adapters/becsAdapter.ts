import { setTimeout as sleep } from "node:timers/promises";
import {
  CancelTransferRequest,
  CreateBecsDebitRequest,
  PersistedTransferRepository,
  TransferRail,
  TransferRecord,
  TransferStatus,
  createBecsDebitRequestSchema,
  cancelTransferRequestSchema,
} from "@apgms/shared";
import { BecsClient } from "../types";

const DEFAULT_RETRY_DELAYS = [250, 500, 1000];

type LogPayload = Record<string, unknown>;

export interface LoggerLike {
  debug(obj: LogPayload, message?: string): void;
  info(obj: LogPayload, message?: string): void;
  warn(obj: LogPayload, message?: string): void;
  error(obj: LogPayload, message?: string): void;
  child?(bindings: LogPayload): LoggerLike;
}

const consoleLogger: LoggerLike = {
  debug(obj, message) {
    console.debug(message ?? "", obj);
  },
  info(obj, message) {
    console.info(message ?? "", obj);
  },
  warn(obj, message) {
    console.warn(message ?? "", obj);
  },
  error(obj, message) {
    console.error(message ?? "", obj);
  },
  child(bindings) {
    return {
      debug(obj, message) {
        consoleLogger.debug({ ...bindings, ...obj }, message);
      },
      info(obj, message) {
        consoleLogger.info({ ...bindings, ...obj }, message);
      },
      warn(obj, message) {
        consoleLogger.warn({ ...bindings, ...obj }, message);
      },
      error(obj, message) {
        consoleLogger.error({ ...bindings, ...obj }, message);
      },
    } satisfies LoggerLike;
  },
};

export type BecsAdapterErrorCode = "VALIDATION_FAILED" | "NOT_FOUND" | "RAIL_ERROR";

export class BecsAdapterError extends Error {
  constructor(
    message: string,
    readonly code: BecsAdapterErrorCode,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BecsAdapterError";
  }
}

export interface BecsAdapterOptions {
  client: BecsClient;
  store: PersistedTransferRepository;
  logger?: LoggerLike;
  retryDelaysMs?: number[];
  sleepFn?: (ms: number) => Promise<void>;
}

export class BecsAdapter {
  private readonly logger: LoggerLike;
  private readonly retryDelays: number[];
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: BecsAdapterOptions) {
    this.logger = options.logger ?? consoleLogger;
    this.retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
    this.sleep = options.sleepFn ?? ((ms) => sleep(ms));
  }

  async createDebit(input: CreateBecsDebitRequest): Promise<TransferRecord> {
    const parsed = this.safeParseCreateRequest(input);

    const existing = await this.options.store.findByRequestId(parsed.requestId);
    if (existing) {
      this.logger.info({ requestId: parsed.requestId }, "idempotent hit for createDebit");
      return existing;
    }

    const metadata = this.buildMetadata(parsed);
    const transfer = await this.options.store.createTransfer({
      orgId: parsed.orgId,
      requestId: parsed.requestId,
      rail: "BECS" as TransferRail,
      amount: parsed.amount.value,
      currency: parsed.amount.currency,
      metadata,
    });

    try {
      const response = await this.executeWithRetry(
        "createDebit",
        parsed.requestId,
        async (attempt) => {
          this.logger.debug({ requestId: parsed.requestId, attempt }, "invoking BECS createDebit");
          return this.options.client.createDebit({
            requestId: parsed.requestId,
            amount: parsed.amount,
            account: parsed.account,
            customer: parsed.customer,
            description: parsed.description,
            debitDate: parsed.debitDate?.toISOString(),
            metadata: parsed.metadata,
          });
        },
      );

      await this.options.store.saveEvent({
        transferId: transfer.id,
        requestId: this.eventKey(parsed.requestId, "create"),
        kind: "BECS_CREATE_DEBIT",
        payload: {
          request: this.redactAccount(parsed),
          response,
        },
      });

      const mergedMetadata = {
        ...(metadata ?? {}),
        lastSubmissionAt: response.submittedAt ?? new Date().toISOString(),
      } as Record<string, unknown>;

      return this.options.store.updateTransfer(transfer.id, {
        status: this.normalizeStatus(response.status, "SUBMITTED"),
        externalId: response.externalId,
        metadata: mergedMetadata,
      });
    } catch (error) {
      await this.options.store.saveEvent({
        transferId: transfer.id,
        requestId: this.eventKey(parsed.requestId, "create:failure"),
        kind: "BECS_CREATE_DEBIT_FAILED",
        payload: {
          request: this.redactAccount(parsed),
          error: this.serializeError(error),
        },
      });

      await this.options.store.updateTransfer(transfer.id, {
        status: "FAILED",
        metadata: {
          ...(metadata ?? {}),
          lastError: this.serializeError(error),
        },
      });

      throw this.toAdapterError(error);
    }
  }

  async getStatus(transferId: string): Promise<TransferRecord> {
    const transfer = await this.options.store.getById(transferId);
    if (!transfer) {
      throw new BecsAdapterError(`transfer ${transferId} not found`, "NOT_FOUND");
    }

    if (!transfer.externalId) {
      return transfer;
    }

    try {
      const response = await this.executeWithRetry("getStatus", transfer.requestId, async () => {
        return this.options.client.getDebitStatus(transfer.externalId!);
      });

      if (response.status === transfer.status) {
        return transfer;
      }

      const metadata = {
        ...(transfer.metadata ?? {}),
        lastStatusAt: new Date().toISOString(),
        settledAt: response.settledAt ?? (transfer.metadata as Record<string, unknown> | null)?.settledAt,
      } as Record<string, unknown>;

      return this.options.store.updateTransfer(transfer.id, {
        status: this.normalizeStatus(response.status, transfer.status),
        metadata,
      });
    } catch (error) {
      this.logger.error({ transferId, error: this.serializeError(error) }, "failed to poll BECS status");
      throw this.toAdapterError(error);
    }
  }

  async cancel(input: CancelTransferRequest): Promise<TransferRecord> {
    const parsed = this.safeParseCancelRequest(input);

    const transfer = await this.options.store.getById(parsed.transferId);
    if (!transfer) {
      throw new BecsAdapterError(`transfer ${parsed.transferId} not found`, "NOT_FOUND");
    }

    const eventKey = this.eventKey(parsed.requestId, "cancel");
    const existingEvent = await this.options.store.getEventByRequestId(eventKey);
    if (existingEvent) {
      this.logger.info({ requestId: parsed.requestId }, "idempotent hit for cancel");
      const latest = await this.options.store.getById(parsed.transferId);
      if (!latest) {
        throw new BecsAdapterError(`transfer ${parsed.transferId} not found`, "NOT_FOUND");
      }
      return latest;
    }

    if (!transfer.externalId) {
      const updated = await this.options.store.updateTransfer(transfer.id, {
        status: "FAILED",
        metadata: {
          ...(transfer.metadata ?? {}),
          cancelledAt: new Date().toISOString(),
          cancellationReason: parsed.reason ?? null,
        },
      });

      await this.options.store.saveEvent({
        transferId: transfer.id,
        requestId: eventKey,
        kind: "BECS_CANCEL_DEBIT",
        payload: {
          request: { reason: parsed.reason ?? null },
          response: { status: updated.status, externalId: null },
        },
      });

      return updated;
    }

    try {
      const response = await this.executeWithRetry(
        "cancelDebit",
        parsed.requestId,
        async () =>
          this.options.client.cancelDebit({
            externalId: transfer.externalId!,
            reason: parsed.reason,
          }),
      );

      const metadata = {
        ...(transfer.metadata ?? {}),
        cancelledAt: response.cancelledAt ?? new Date().toISOString(),
        cancellationReason: parsed.reason ?? null,
      } as Record<string, unknown>;

      const updated = await this.options.store.updateTransfer(transfer.id, {
        status: this.normalizeStatus(response.status, "FAILED"),
        metadata,
      });

      await this.options.store.saveEvent({
        transferId: transfer.id,
        requestId: eventKey,
        kind: "BECS_CANCEL_DEBIT",
        payload: {
          request: { reason: parsed.reason ?? null },
          response,
        },
      });

      return updated;
    } catch (error) {
      await this.options.store.saveEvent({
        transferId: transfer.id,
        requestId: this.eventKey(parsed.requestId, "cancel:failure"),
        kind: "BECS_CANCEL_DEBIT_FAILED",
        payload: {
          request: { reason: parsed.reason ?? null },
          error: this.serializeError(error),
        },
      });
      throw this.toAdapterError(error);
    }
  }

  private safeParseCreateRequest(input: CreateBecsDebitRequest): CreateBecsDebitRequest {
    const parsed = createBecsDebitRequestSchema.safeParse(input);
    if (!parsed.success) {
      this.logger.warn({ issues: parsed.error.issues }, "createDebit validation failed");
      throw new BecsAdapterError("createDebit validation failed", "VALIDATION_FAILED", parsed.error.flatten());
    }
    return parsed.data;
  }

  private safeParseCancelRequest(input: CancelTransferRequest): CancelTransferRequest {
    const parsed = cancelTransferRequestSchema.safeParse(input);
    if (!parsed.success) {
      this.logger.warn({ issues: parsed.error.issues }, "cancel validation failed");
      throw new BecsAdapterError("cancel validation failed", "VALIDATION_FAILED", parsed.error.flatten());
    }
    return parsed.data;
  }

  private eventKey(requestId: string, suffix: string): string {
    return `${requestId}:${suffix}`;
  }

  private normalizeStatus(status: string | undefined, fallback: TransferStatus): TransferStatus {
    switch (status) {
      case "PENDING":
      case "SUBMITTED":
      case "SETTLED":
      case "FAILED":
        return status;
      default:
        return fallback;
    }
  }

  private redactAccount(request: CreateBecsDebitRequest) {
    const maskedAccountNumber = request.account.accountNumber.replace(/\d(?=\d{3})/g, "*");
    return {
      ...request,
      account: {
        ...request.account,
        accountNumber: maskedAccountNumber,
      },
    };
  }

  private buildMetadata(request: CreateBecsDebitRequest): Record<string, unknown> {
    return {
      customer: {
        name: request.customer.name,
        reference: request.customer.reference,
        email: request.customer.email ?? null,
      },
      account: {
        accountName: request.account.accountName,
        bsb: request.account.bsb,
        lastThree: request.account.accountNumber.slice(-3),
      },
      description: request.description,
      debitDate: request.debitDate?.toISOString() ?? null,
      metadata: request.metadata ?? null,
    };
  }

  private async executeWithRetry<T>(
    operation: string,
    requestId: string,
    fn: (attempt: number) => Promise<T>,
  ): Promise<T> {
    let attempt = 0;
    const maxAttempts = this.retryDelays.length + 1;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await fn(attempt);
      } catch (error) {
        this.logger.warn({ operation, attempt, requestId, error: this.serializeError(error) }, "BECS operation failed");
        if (attempt >= maxAttempts) {
          throw error;
        }
        const delay = this.retryDelays[attempt - 1] ?? 0;
        await this.sleep(delay);
      }
    }
    throw new BecsAdapterError(`${operation} exhausted retries`, "RAIL_ERROR");
  }

  private serializeError(error: unknown) {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    }
    return { message: String(error ?? "unknown error") };
  }

  private toAdapterError(error: unknown): BecsAdapterError {
    if (error instanceof BecsAdapterError) {
      return error;
    }

    const serialised = this.serializeError(error);
    return new BecsAdapterError(serialised.message, "RAIL_ERROR", serialised);
  }
}
