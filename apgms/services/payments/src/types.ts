export type PaymentMethod = 'PAYTO' | 'BECS';

export type RemittanceStatus = 'PENDING' | 'INITIATED' | 'SETTLED';

export interface RemittanceEvent {
  readonly type: string;
  readonly at: string;
  readonly detail?: Record<string, unknown>;
}

export interface Remittance {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly beneficiary: string;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: RemittanceStatus;
  readonly events: readonly RemittanceEvent[];
  readonly remoteReference?: string;
}

export interface CreateRemittanceInput {
  readonly amount: number;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly beneficiary: string;
  readonly correlationId?: string;
}

export interface PaymentAdapterContext {
  readonly correlationId: string;
}

export interface PaymentAdapter {
  create(remittance: Remittance, context: PaymentAdapterContext): Promise<{
    transferId: string;
  }>;

  status(transferId: string, context: PaymentAdapterContext): Promise<'INITIATED' | 'SETTLED'>;

  cancel(transferId: string, context: PaymentAdapterContext): Promise<void>;
}
