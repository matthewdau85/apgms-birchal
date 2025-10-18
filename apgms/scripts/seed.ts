import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Demo Org" },
  });

  await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: {},
    create: { email: "founder@example.com", password: "password123", orgId: org.id },
  });

  const today = new Date();
  await prisma.bankLine.createMany({
    data: [
      {
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
        amount: new Prisma.Decimal(1250.75),
        payee: "Acme",
        desc: "Office fit-out",
      },
      {
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
        amount: new Prisma.Decimal(-299.99),
        payee: "CloudCo",
        desc: "Monthly sub",
      },
      {
        orgId: org.id,
        date: today,
        amount: new Prisma.Decimal(5000),
        payee: "Birchal",
        desc: "Investment received",
      },
    ],
    skipDuplicates: true,
  });

  const designatedAccount = await prisma.designatedAccount.upsert({
    where: { accountNo: "12345678" },
    update: {
      label: "Primary Settlement",
      bankName: "Birchal Bank",
      status: "ACTIVE",
    },
    create: {
      orgId: org.id,
      label: "Primary Settlement",
      accountNo: "12345678",
      bankName: "Birchal Bank",
    },
  });

  await prisma.obligationSnapshot.upsert({
    where: { id: "demo-obligation-snapshot" },
    update: {
      totalObligation: new Prisma.Decimal(8750.5),
      notes: "Includes pending share issuance fees.",
    },
    create: {
      id: "demo-obligation-snapshot",
      orgId: org.id,
      effectiveDate: today,
      totalObligation: new Prisma.Decimal(8750.5),
      notes: "Includes pending share issuance fees.",
    },
  });

  const settlementInstruction = await prisma.settlementInstruction.upsert({
    where: { instructionRef: "SI-0001" },
    update: {
      designatedAccountId: designatedAccount.id,
      status: "SENT",
    },
    create: {
      orgId: org.id,
      designatedAccountId: designatedAccount.id,
      counterparty: "Birchal Nominees",
      amount: new Prisma.Decimal(4200),
      dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
      status: "PENDING",
      instructionRef: "SI-0001",
    },
  });

  await prisma.discrepancyEvent.upsert({
    where: { id: "demo-discrepancy" },
    update: {
      instructionId: settlementInstruction.id,
      resolutionNote: "Awaiting confirmation from counterparty.",
    },
    create: {
      id: "demo-discrepancy",
      orgId: org.id,
      instructionId: settlementInstruction.id,
      description: "Counterparty acknowledgement delayed",
      severity: "MEDIUM",
      resolutionNote: "Awaiting confirmation from counterparty.",
    },
  });

  await prisma.complianceDocument.upsert({
    where: { id: "demo-compliance-doc" },
    update: {
      expiresAt: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()),
    },
    create: {
      id: "demo-compliance-doc",
      orgId: org.id,
      title: "AFS Licence",
      documentType: "LICENCE",
      storageUrl: "https://example.com/docs/afs-licence.pdf",
      expiresAt: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()),
    },
  });

  console.log("Seed OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
