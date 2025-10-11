export type MandateStatus = 'pending' | 'active' | 'revoked';
export type PaymentStatus = 'pending' | 'settled' | 'failed' | 'refunded';
export type RptStatus = 'pending' | 'valid' | 'expired' | 'revoked';

export interface MandateRequest {
  customerId: string;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface Mandate extends MandateRequest {
  id: string;
  status: MandateStatus;
  createdAt: Date;
  rptStatus: RptStatus;
  rptValidUntil?: Date;
  rptVerifiedAt?: Date;
}

export interface DebitRequest {
  mandateId: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface Debit {
  id: string;
  mandateId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface RefundRequest {
  debitId: string;
  amountCents?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface Refund {
  id: string;
  debitId: string;
  amountCents: number;
  status: PaymentStatus;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PaymentStatusResult {
  reference: string;
  status: PaymentStatus;
  lastUpdated: Date;
  details?: string;
}

export interface WebhookEvent<T = unknown> {
  id: string;
  type: string;
  createdAt: string;
  data: T;
}

export interface WebhookValidationResult<T = unknown> {
  valid: boolean;
  replayed: boolean;
  event?: WebhookEvent<T>;
}

export interface OperationOptions {
  idempotencyKey?: string;
}

export interface IPaymentRail {
  readonly name: string;
  createMandate(request: MandateRequest, options?: OperationOptions): Promise<Mandate>;
  initiateDebit(request: DebitRequest, options?: OperationOptions): Promise<Debit>;
  refund(request: RefundRequest, options?: OperationOptions): Promise<Refund>;
  getStatus(reference: string): Promise<PaymentStatusResult>;
  verifyWebhook<T = unknown>(payload: string, signature: string): WebhookValidationResult<T>;
}
