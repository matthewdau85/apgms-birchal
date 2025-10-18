import { MonetaryAmount } from "@apgms/shared";

export interface BecsClientCreateDebitRequest {
  requestId: string;
  amount: MonetaryAmount;
  account: {
    accountName: string;
    bsb: string;
    accountNumber: string;
  };
  customer: {
    name: string;
    reference: string;
    email?: string;
  };
  description: string;
  debitDate?: string;
  metadata?: Record<string, unknown>;
}

export interface BecsClientCreateDebitResponse {
  externalId: string;
  status?: "PENDING" | "SUBMITTED" | "SETTLED" | "FAILED";
  submittedAt?: string;
  raw?: unknown;
}

export interface BecsClientGetStatusResponse {
  status: "PENDING" | "SUBMITTED" | "SETTLED" | "FAILED";
  settledAt?: string;
  raw?: unknown;
}

export interface BecsClientCancelRequest {
  externalId: string;
  reason?: string;
}

export interface BecsClientCancelResponse {
  status: "FAILED" | "PENDING" | "SUBMITTED" | "SETTLED";
  cancelledAt?: string;
  raw?: unknown;
}

export interface BecsClient {
  createDebit(request: BecsClientCreateDebitRequest): Promise<BecsClientCreateDebitResponse>;
  getDebitStatus(externalId: string): Promise<BecsClientGetStatusResponse>;
  cancelDebit(request: BecsClientCancelRequest): Promise<BecsClientCancelResponse>;
}
