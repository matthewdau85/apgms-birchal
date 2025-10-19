export type Role = "admin_compliance" | "system" | (string & {});

export type GateReason = "MANUAL" | "ANOMALY_HARD" | (string & {});

export interface GateState {
  id: string;
  status: "OPEN" | "CLOSED";
  reason?: GateReason;
  opensAt?: Date | null;
  locked: boolean;
  updatedAt: Date;
}

export interface GateClosureOptions {
  reason: GateReason;
  actorRole: Role;
  opensAt?: Date | null;
  requireAdminOverride?: boolean;
}

export interface RemittanceRequest {
  id: string;
  gateId: string;
  amount: number;
  opensAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface RemittanceLedgerEntry {
  remittanceId: string;
  gateId: string;
  amount: number;
  recordedAt: Date;
}

export interface ScheduledRemittance {
  remittanceId: string;
  gateId: string;
  payload: RemittanceRequest;
  scheduledAt: Date;
  opensAt: Date;
}

export interface AnomalyEvaluation {
  severity: "NONE" | "SOFT" | "HARD";
  detail?: string;
  opensAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface AnomalyPipeline {
  evaluate(request: RemittanceRequest): Promise<AnomalyEvaluation>;
}

export interface AlertEvent {
  type: "ANOMALY_HARD";
  gateId: string;
  remittanceId: string;
  severity: "HARD";
  detail?: string;
  emittedAt: Date;
  metadata?: Record<string, unknown>;
}

export type AuditEvent =
  | {
      type: "GATE_CLOSED";
      gateId: string;
      actorRole: Role;
      reason: GateReason;
      occurredAt: Date;
      opensAt: Date | null;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "GATE_OPENED";
      gateId: string;
      actorRole: Role;
      occurredAt: Date;
      metadata?: Record<string, unknown>;
    };

export type Clock = () => Date;
