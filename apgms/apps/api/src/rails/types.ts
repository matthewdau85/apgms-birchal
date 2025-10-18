export type RailCode = "payto" | "becs";

export interface RemittanceInstruction {
  id: string;
  gateId: string;
  rail: RailCode;
  amount: number;
  currency: string;
  beneficiaryName: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface RemittanceInitiatedEvent {
  remittanceId: string;
  initiatedAt: Date;
  reference: string;
  raw?: Record<string, unknown>;
}

export interface RemittanceSettledEvent {
  remittanceId: string;
  settledAt: Date;
  receipt?: string;
}

export interface RemittanceFailedEvent {
  remittanceId: string;
  failedAt: Date;
  reason: string;
}

export interface RailLifecycleCallbacks {
  onInitiated: (event: RemittanceInitiatedEvent) => void;
  onSettled: (event: RemittanceSettledEvent) => void;
  onFailed: (event: RemittanceFailedEvent) => void;
}

export interface RailAdapter {
  readonly id: string;
  readonly rail: RailCode;
  initiate: (
    remittance: RemittanceInstruction,
    callbacks: RailLifecycleCallbacks,
  ) => Promise<void>;
  cancel?: (remittanceId: string) => Promise<void>;
}
