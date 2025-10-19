import { prisma, writeAuditBlob } from "@apgms/shared";

export async function createAgreement({
  orgId,
  maskedBsb,
  maskedAcc,
}: {
  orgId: string;
  maskedBsb: string;
  maskedAcc: string;
}) {
  const agreement = await prisma.payToAgreement.create({
    data: {
      orgId,
      maskedBsb,
      maskedAcc,
    },
  });

  await writeAuditBlob({
    scope: "payto.create_agreement",
    orgId,
    payload: {
      agreementId: agreement.id,
      maskedBsb,
      maskedAcc,
    },
  });

  return { agreementId: agreement.id };
}

export async function remit({
  orgId,
  amountCents,
}: {
  orgId: string;
  amountCents: number;
}) {
  const remittance = await prisma.payToRemittance.create({
    data: {
      orgId,
      amountCents,
      status: "QUEUED",
    },
  });

  await writeAuditBlob({
    scope: "payto.remit.queued",
    orgId,
    payload: {
      remittanceId: remittance.id,
      amountCents,
      status: remittance.status,
    },
  });

  return { status: remittance.status, remittanceId: remittance.id };
}
