import { randomUUID } from 'node:crypto';
import {
  PaytoAgreement,
  PaytoAgreementInput,
  PaytoRemittanceRequest,
} from '../../../../shared/src/payto.js';

export interface PaytoRemittance extends PaytoRemittanceRequest {
  remitId: string;
  processedAt: string;
}

export type PaytoAuditBlobType =
  | 'payto.agreement.created'
  | 'payto.remittance.processed';

export interface PaytoAuditBlob<TPayload = unknown> {
  id: string;
  type: PaytoAuditBlobType;
  occurredAt: string;
  payload: TPayload;
}

const agreements = new Map<string, PaytoAgreement>();
const remittances = new Map<string, PaytoRemittance>();
const auditTrail: PaytoAuditBlob[] = [];

export function createAgreement(input: PaytoAgreementInput): PaytoAgreement {
  const agreementId = input.agreementId ?? randomUUID();
  const agreement: PaytoAgreement = {
    ...input,
    agreementId,
    createdAt: new Date().toISOString(),
  };

  agreements.set(agreementId, agreement);
  writeAuditBlob('payto.agreement.created', agreement);
  return agreement;
}

export function remit(input: PaytoRemittanceRequest): PaytoRemittance {
  const agreement = agreements.get(input.agreementId);

  if (!agreement) {
    throw new Error(`Unknown agreement: ${input.agreementId}`);
  }

  const remitId = input.remitId ?? randomUUID();
  const remittance: PaytoRemittance = {
    ...input,
    remitId,
    processedAt: new Date().toISOString(),
  };

  remittances.set(remitId, remittance);
  writeAuditBlob('payto.remittance.processed', {
    ...remittance,
    agreement,
  });

  return remittance;
}

export function getAgreement(agreementId: string): PaytoAgreement | undefined {
  return agreements.get(agreementId);
}

export function listRemittances(): PaytoRemittance[] {
  return Array.from(remittances.values()).map((entry) => ({ ...entry }));
}

export function getAuditTrail(): PaytoAuditBlob[] {
  return auditTrail.map((blob) => ({ ...blob }));
}

export function resetPaytoMockState(): void {
  agreements.clear();
  remittances.clear();
  auditTrail.splice(0, auditTrail.length);
}

function writeAuditBlob<TPayload>(type: PaytoAuditBlobType, payload: TPayload): void {
  auditTrail.push({
    id: randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    payload,
  });
}
