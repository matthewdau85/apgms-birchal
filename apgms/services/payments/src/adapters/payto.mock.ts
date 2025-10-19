import { recordAuditBlob } from "@apgms/shared/audit-blob";
import { getGateId } from "@apgms/shared/gates";
import { generateId } from "@apgms/shared/id";

export type PayToAgreement = {
  agreementId: string;
  orgId: string;
  payeeName: string;
  bsbMasked: string;
  accMasked: string;
  createdAt: string;
};

type PayToAgreementInput = {
  orgId: string;
  payeeName: string;
  bsb: string;
  acc: string;
};

type RemitInput = {
  orgId: string;
  agreementId: string;
  amountCents: number;
  currency: "AUD";
};

type RemitResult = {
  remittanceId: string;
  status: "QUEUED" | "SENT";
  createdAt: string;
};

const agreements = new Map<string, PayToAgreement>();

function mask(value: string, visibleDigits: number): string {
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= visibleDigits) {
    return "*".repeat(compact.length);
  }
  const hiddenCount = Math.max(0, compact.length - visibleDigits);
  return "*".repeat(hiddenCount) + compact.slice(-visibleDigits);
}

export async function createAgreement(input: PayToAgreementInput): Promise<PayToAgreement> {
  const agreement: PayToAgreement = {
    agreementId: generateId("agt"),
    orgId: input.orgId,
    payeeName: input.payeeName,
    bsbMasked: mask(input.bsb, 2),
    accMasked: mask(input.acc, 3),
    createdAt: new Date().toISOString(),
  };

  agreements.set(agreement.agreementId, agreement);

  await recordAuditBlob({
    kind: "payto.createAgreement",
    payloadJson: {
      agreementId: agreement.agreementId,
      orgId: agreement.orgId,
      payeeName: agreement.payeeName,
    },
    orgId: agreement.orgId,
    gateId: getGateId(agreement.orgId),
  });

  return agreement;
}

export async function remit(input: RemitInput): Promise<RemitResult> {
  const result: RemitResult = {
    remittanceId: generateId("rem"),
    status: "SENT",
    createdAt: new Date().toISOString(),
  };

  await recordAuditBlob({
    kind: "payto.remit",
    payloadJson: {
      orgId: input.orgId,
      agreementId: input.agreementId,
      amountCents: input.amountCents,
      currency: input.currency,
    },
    orgId: input.orgId,
    gateId: getGateId(input.orgId),
  });

  return result;
}

export function getAgreement(agreementId: string): PayToAgreement | undefined {
  return agreements.get(agreementId);
}

export function resetAgreements(): void {
  agreements.clear();
}
