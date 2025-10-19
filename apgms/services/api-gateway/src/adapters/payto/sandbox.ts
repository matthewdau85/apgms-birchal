import { randomUUID } from "node:crypto";

type Status = "PENDING" | "ACTIVE" | "REVOKED";

type PaymentStatus = "PENDING" | "SETTLED" | "FAILED";

interface ConsentRecord {
  id: string;
  orgId: string;
  bank: string;
  accountRef: string;
  status: Status;
}

interface MandateRecord {
  id: string;
  orgId: string;
  bankConnectionId: string;
  reference: string;
  amountLimitCents: number;
  status: Status;
}

const consents = new Map<string, ConsentRecord>();
const mandates = new Map<string, MandateRecord>();

function nowISO() {
  return new Date().toISOString();
}

export async function createConsent(input: {
  orgId: string;
  bank: string;
  accountRef: string;
}) {
  const id = `consent_${randomUUID()}`;
  const record: ConsentRecord = {
    id,
    orgId: input.orgId,
    bank: input.bank,
    accountRef: input.accountRef,
    status: "PENDING",
  };
  consents.set(id, record);
  return {
    id,
    status: record.status,
    redirectUrl: `https://sandbox.bank.example/consents/${id}`,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  };
}

export async function createMandate(input: {
  orgId: string;
  bankConnectionId: string;
  reference: string;
  amountLimitCents: number;
}) {
  const consent = consents.get(input.bankConnectionId);
  if (!consent) {
    throw new Error("bank_connection_not_found");
  }
  const id = `mandate_${randomUUID()}`;
  const record: MandateRecord = {
    id,
    orgId: input.orgId,
    bankConnectionId: input.bankConnectionId,
    reference: input.reference,
    amountLimitCents: input.amountLimitCents,
    status: "PENDING",
  };
  mandates.set(id, record);
  return {
    id,
    status: record.status,
    nextEvent: {
      endpoint: "/webhooks/payto/mandate",
      body: {
        type: "mandate.updated",
        orgId: input.orgId,
        mandateId: id,
        bankConnectionId: input.bankConnectionId,
        reference: input.reference,
        status: record.status,
        amountLimitCents: input.amountLimitCents,
        occurredAt: nowISO(),
      },
    },
  };
}

export function simulateEvents() {
  return {
    consent(consentId: string, status: Status = "ACTIVE") {
      const consent = consents.get(consentId);
      if (!consent) {
        throw new Error("consent_not_found");
      }
      consent.status = status;
      const occurredAt = nowISO();
      return {
        endpoint: "/webhooks/payto/consent",
        body: {
          type: "consent.updated",
          orgId: consent.orgId,
          bankConnectionId: consent.id,
          status,
          occurredAt,
        },
      };
    },
    mandate(mandateId: string, status: Status = "ACTIVE") {
      const mandate = mandates.get(mandateId);
      if (!mandate) {
        throw new Error("mandate_not_found");
      }
      mandate.status = status;
      const occurredAt = nowISO();
      return {
        endpoint: "/webhooks/payto/mandate",
        body: {
          type: "mandate.updated",
          orgId: mandate.orgId,
          mandateId: mandate.id,
          bankConnectionId: mandate.bankConnectionId,
          reference: mandate.reference,
          status,
          amountLimitCents: mandate.amountLimitCents,
          occurredAt,
        },
      };
    },
    payment(mandateId: string, amountCents: number, status: PaymentStatus = "SETTLED") {
      const mandate = mandates.get(mandateId);
      if (!mandate) {
        throw new Error("mandate_not_found");
      }
      return {
        endpoint: "/webhooks/payto/payment",
        body: {
          type: "payment.processed",
          orgId: mandate.orgId,
          mandateId: mandate.id,
          paymentId: `payment_${randomUUID()}`,
          amountCents,
          status,
          occurredAt: nowISO(),
        },
      };
    },
  };
}

export function resetSandbox() {
  consents.clear();
  mandates.clear();
}
