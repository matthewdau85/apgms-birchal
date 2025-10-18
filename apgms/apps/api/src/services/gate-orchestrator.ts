import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import {
  RailAdapter,
  RailCode,
  RailLifecycleCallbacks,
  RemittanceInstruction,
} from "../rails";

export type RemittanceStatus =
  | "pending"
  | "initiating"
  | "initiated"
  | "settled"
  | "failed";

export interface RemittanceHistoryEntry {
  status: RemittanceStatus;
  at: Date;
  note?: string;
}

export interface RemittanceRecord extends RemittanceInstruction {
  status: RemittanceStatus;
  updatedAt: Date;
  reference?: string;
  receipt?: string;
  failureReason?: string;
  history: RemittanceHistoryEntry[];
}

export interface GateConfig {
  id: string;
  label: string;
  rail: RailCode;
  initiallyOpen?: boolean;
}

export interface GateState extends GateConfig {
  isOpen: boolean;
  lastChangedAt: Date;
}

export type AuditEntryType =
  | "gate.opened"
  | "gate.closed"
  | "remittance.created"
  | "remittance.initiated"
  | "remittance.settled"
  | "remittance.failed";

export interface AuditEntry {
  id: string;
  occurredAt: Date;
  type: AuditEntryType;
  message: string;
  gateId?: string;
  remittanceId?: string;
  details?: Record<string, unknown>;
}

export interface GateOrchestratorOptions {
  gates: GateConfig[];
  adapters: RailAdapter[];
  pollIntervalMs?: number;
}

export interface CreateRemittanceInput {
  gateId: string;
  amount: number;
  currency: string;
  beneficiaryName: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GateOrchestratorSnapshot {
  gates: GateState[];
  remittances: RemittanceRecord[];
  audits: AuditEntry[];
}

type GateOrchestratorEvents = {
  audit: (entry: AuditEntry) => void;
  "remittance:updated": (record: RemittanceRecord) => void;
};

type EventKeys = keyof GateOrchestratorEvents;

export class GateOrchestrator extends EventEmitter {
  private readonly gates = new Map<string, GateState>();
  private readonly remittances = new Map<string, RemittanceRecord>();
  private readonly adapters = new Map<RailCode, RailAdapter>();
  private readonly auditLog: AuditEntry[] = [];
  private readonly pollIntervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(options: GateOrchestratorOptions) {
    super();
    this.pollIntervalMs = options.pollIntervalMs ?? 500;

    for (const adapter of options.adapters) {
      this.adapters.set(adapter.rail, adapter);
    }

    const now = new Date();
    for (const gate of options.gates) {
      const state: GateState = {
        ...gate,
        isOpen: Boolean(gate.initiallyOpen),
        lastChangedAt: now,
      };
      this.gates.set(gate.id, state);
    }
  }

  override on<T extends EventKeys>(eventName: T, listener: GateOrchestratorEvents[T]): this {
    return super.on(eventName, listener as any);
  }

  override once<T extends EventKeys>(eventName: T, listener: GateOrchestratorEvents[T]): this {
    return super.once(eventName, listener as any);
  }

  override off<T extends EventKeys>(eventName: T, listener: GateOrchestratorEvents[T]): this {
    return super.off(eventName, listener as any);
  }

  start(): void {
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.tick();
      }, this.pollIntervalMs);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  createPendingRemittance(input: CreateRemittanceInput): RemittanceRecord {
    const gate = this.getGateOrThrow(input.gateId);
    const id = randomUUID();
    const createdAt = new Date();
    const remittance: RemittanceRecord = {
      id,
      gateId: gate.id,
      rail: gate.rail,
      amount: input.amount,
      currency: input.currency,
      beneficiaryName: input.beneficiaryName,
      description: input.description,
      metadata: input.metadata,
      createdAt,
      status: "pending",
      updatedAt: createdAt,
      history: [
        {
          status: "pending",
          at: createdAt,
          note: "remittance enqueued",
        },
      ],
    };

    this.remittances.set(remittance.id, remittance);
    this.recordAudit("remittance.created", `Pending remittance ${remittance.id} created`, {
      remittanceId: remittance.id,
      gateId: gate.id,
      amount: remittance.amount,
      currency: remittance.currency,
    });

    void this.triggerIfOpen(remittance);

    return cloneRemittance(remittance);
  }

  setGateOpen(gateId: string, open: boolean): GateState {
    const gate = this.getGateOrThrow(gateId);
    if (gate.isOpen === open) {
      return cloneGate(gate);
    }

    gate.isOpen = open;
    gate.lastChangedAt = new Date();
    this.recordAudit(open ? "gate.opened" : "gate.closed", `${gate.label} gate ${open ? "opened" : "closed"}`, {
      gateId: gate.id,
    });

    if (open) {
      for (const remittance of this.remittances.values()) {
        if (remittance.gateId === gate.id && remittance.status === "pending") {
          void this.triggerIfOpen(remittance);
        }
      }
    }

    return cloneGate(gate);
  }

  getGateState(gateId: string): GateState {
    return cloneGate(this.getGateOrThrow(gateId));
  }

  getSnapshot(): GateOrchestratorSnapshot {
    return {
      gates: Array.from(this.gates.values()).map((gate) => cloneGate(gate)),
      remittances: Array.from(this.remittances.values()).map((remittance) =>
        cloneRemittance(remittance),
      ),
      audits: [...this.auditLog],
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  private async tick(): Promise<void> {
    for (const gate of this.gates.values()) {
      if (!gate.isOpen) {
        continue;
      }

      for (const remittance of this.remittances.values()) {
        if (remittance.gateId !== gate.id) {
          continue;
        }
        if (remittance.status !== "pending") {
          continue;
        }
        await this.triggerIfOpen(remittance);
      }
    }
  }

  private async triggerIfOpen(remittance: RemittanceRecord): Promise<void> {
    const gate = this.getGateOrThrow(remittance.gateId);
    if (!gate.isOpen) {
      return;
    }

    if (remittance.status !== "pending") {
      return;
    }

    const adapter = this.adapters.get(gate.rail);
    if (!adapter) {
      this.failRemittance(remittance.id, "No adapter is registered for the gate's rail");
      return;
    }

    this.updateRemittance(remittance.id, "initiating", {
      note: `Sending remittance to ${adapter.id}`,
    });

    try {
      await adapter.initiate(remittance, this.createLifecycleCallbacks(remittance.id));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown adapter error";
      this.failRemittance(remittance.id, reason);
    }
  }

  private createLifecycleCallbacks(remittanceId: string): RailLifecycleCallbacks {
    return {
      onInitiated: (event) => {
        this.updateRemittance(remittanceId, "initiated", {
          note: `Rail reference ${event.reference}`,
          extra: { reference: event.reference, initiatedAt: event.initiatedAt },
          at: event.initiatedAt,
        });
        const remittance = this.remittances.get(remittanceId);
        if (remittance) {
          remittance.reference = event.reference;
        }
        this.recordAudit(
          "remittance.initiated",
          `Remittance ${remittanceId} initiated on rail ${event.reference}`,
          {
            remittanceId,
            reference: event.reference,
          },
        );
      },
      onSettled: (event) => {
        this.updateRemittance(remittanceId, "settled", {
          note: "Rail marked remittance as settled",
          extra: { settledAt: event.settledAt, receipt: event.receipt },
          at: event.settledAt,
        });
        const settledRemittance = this.remittances.get(remittanceId);
        if (settledRemittance) {
          settledRemittance.receipt = event.receipt;
        }
        this.recordAudit("remittance.settled", `Remittance ${remittanceId} settled`, {
          remittanceId,
          receipt: event.receipt,
        });
      },
      onFailed: (event) => {
        this.updateRemittance(remittanceId, "failed", {
          note: "Rail reported remittance failure",
          extra: { reason: event.reason, failedAt: event.failedAt },
          at: event.failedAt,
        });
        const failedRemittance = this.remittances.get(remittanceId);
        if (failedRemittance) {
          failedRemittance.failureReason = event.reason;
        }
        this.recordAudit("remittance.failed", `Remittance ${remittanceId} failed`, {
          remittanceId,
          reason: event.reason,
        });
      },
    };
  }

  private updateRemittance(
    remittanceId: string,
    status: RemittanceStatus,
    options: { note?: string; extra?: Record<string, unknown>; at?: Date } = {},
  ): void {
    const remittance = this.remittances.get(remittanceId);
    if (!remittance) {
      return;
    }

    const eventTime = options.at ?? new Date();
    remittance.status = status;
    remittance.updatedAt = eventTime;
    remittance.history.push({ status, at: eventTime, note: options.note });
    if (options.extra) {
      remittance.metadata = {
        ...(remittance.metadata ?? {}),
        ...options.extra,
      };
    }

    this.emit("remittance:updated", cloneRemittance(remittance));
  }

  private failRemittance(remittanceId: string, reason: string): void {
    const remittance = this.remittances.get(remittanceId);
    if (!remittance) {
      return;
    }
    remittance.failureReason = reason;
    this.updateRemittance(remittanceId, "failed", {
      note: "Adapter rejected remittance",
      extra: { reason },
    });
    this.recordAudit("remittance.failed", `Remittance ${remittanceId} failed`, {
      remittanceId,
      reason,
    });
  }

  private recordAudit(
    type: AuditEntryType,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    const normalizedDetails = details ? { ...details } : undefined;
    const entry: AuditEntry = {
      id: randomUUID(),
      occurredAt: new Date(),
      type,
      message,
      gateId: (normalizedDetails?.gateId as string | undefined) ?? undefined,
      remittanceId: (normalizedDetails?.remittanceId as string | undefined) ?? undefined,
      details: normalizedDetails,
    };
    this.auditLog.push(entry);
    this.emit("audit", { ...entry });
  }

  private getGateOrThrow(gateId: string): GateState {
    const gate = this.gates.get(gateId);
    if (!gate) {
      throw new Error(`Gate ${gateId} is not registered`);
    }
    return gate;
  }
}

function cloneGate(gate: GateState): GateState {
  return {
    ...gate,
    lastChangedAt: new Date(gate.lastChangedAt),
  };
}

function cloneRemittance(remittance: RemittanceRecord): RemittanceRecord {
  return {
    ...remittance,
    createdAt: new Date(remittance.createdAt),
    updatedAt: new Date(remittance.updatedAt),
    history: remittance.history.map((entry) => ({
      ...entry,
      at: new Date(entry.at),
    })),
    metadata: remittance.metadata ? { ...remittance.metadata } : undefined,
  };
}
