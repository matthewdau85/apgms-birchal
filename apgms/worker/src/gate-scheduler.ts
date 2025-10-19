import { prisma, isGateOpen, writeAuditBlob, PAYTO_GATE_ID } from "@apgms/shared";

export async function runGateScheduler() {
  const gateOpen = await isGateOpen(PAYTO_GATE_ID);
  if (!gateOpen) {
    return { gate: "CLOSED", processed: 0 } as const;
  }

  const queued = await prisma.payToRemittance.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  let processed = 0;
  for (const remittance of queued) {
    await prisma.payToRemittance.update({
      where: { id: remittance.id },
      data: { status: "PROCESSING" },
    });

    const audit = await writeAuditBlob({
      scope: "payto.remit.processed",
      orgId: remittance.orgId,
      payload: {
        remittanceId: remittance.id,
        amountCents: remittance.amountCents,
        processedAt: new Date().toISOString(),
      },
    });

    await prisma.payToRemittance.update({
      where: { id: remittance.id },
      data: {
        status: "SUCCESS",
        processedAt: new Date(),
        auditBlobId: audit.id,
      },
    });

    processed += 1;
  }

  return { gate: "OPEN", processed } as const;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGateScheduler()
    .then((result) => {
      console.log(JSON.stringify(result));
      return process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
