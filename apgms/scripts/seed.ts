import { PrismaClient } from "@prisma/client";
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
        externalId: "demo-line-1",
        amountCents: 125075,
        occurredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
        description: "Office fit-out",
      },
      {
        orgId: org.id,
        externalId: "demo-line-2",
        amountCents: -29999,
        occurredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
        description: "Monthly sub",
      },
      {
        orgId: org.id,
        externalId: "demo-line-3",
        amountCents: 500000,
        occurredAt: today,
        description: "Investment received",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed OK");
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
