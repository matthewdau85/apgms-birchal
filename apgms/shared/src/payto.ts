import { randomUUID } from 'node:crypto';

export type GateState = 'OPEN' | 'CLOSED';

export interface PaytoAgreementInput {
  agreementId?: string;
  payerId: string;
  payeeId: string;
  limit: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PaytoAgreement extends PaytoAgreementInput {
  agreementId: string;
  createdAt: string;
}

export interface PaytoRemittanceRequest {
  remitId?: string;
  agreementId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface PaytoQueuedRemittance extends PaytoRemittanceRequest {
  queuedAt: string;
}

const remittanceQueue: PaytoQueuedRemittance[] = [];
let gateState: GateState = 'OPEN';

export function getGateState(): GateState {
  return gateState;
}

export function setGateState(state: GateState): void {
  gateState = state;
}

export function enqueueRemittance(request: PaytoRemittanceRequest): PaytoQueuedRemittance {
  const queued: PaytoQueuedRemittance = {
    ...request,
    remitId: request.remitId ?? randomUUID(),
    queuedAt: new Date().toISOString(),
  };

  remittanceQueue.push(queued);
  return queued;
}

export function peekRemittanceQueue(): PaytoQueuedRemittance[] {
  return remittanceQueue.map((entry) => ({ ...entry }));
}

export function drainRemittanceQueue(): PaytoQueuedRemittance[] {
  const drained = remittanceQueue.splice(0, remittanceQueue.length);
  return drained.map((entry) => ({ ...entry }));
}

export function resetPaytoSharedState(): void {
  remittanceQueue.splice(0, remittanceQueue.length);
  gateState = 'OPEN';
}
