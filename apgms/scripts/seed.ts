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

  const [activePolicy, closedPolicy] = await Promise.all([
    prisma.policy.upsert({
      where: { id: "policy-active" },
      update: { state: "ACTIVE" },
      create: {
        id: "policy-active",
        orgId: org.id,
        name: "Standard Remittance",
        version: 1,
        state: "ACTIVE",
        rulesJson: {
          strategy: "proportional",
          allocations: [
            { bucket: "operations", weight: 0.5 },
            { bucket: "savings", weight: 0.3 },
            { bucket: "tax", weight: 0.2 },
          ],
        },
      },
    }),
    prisma.policy.upsert({
      where: { id: "policy-closed" },
      update: { state: "CLOSED" },
      create: {
        id: "policy-closed",
        orgId: org.id,
        name: "Legacy Policy",
        version: 1,
        state: "CLOSED",
        rulesJson: {
          strategy: "flat",
          allocations: [
            { bucket: "reserve", weight: 1 },
          ],
        },
      },
    }),
  ]);

  await prisma.gate.upsert({
    where: { id: "gate-open" },
    update: {
      state: "OPEN",
      policyId: activePolicy.id,
      reason: null,
    },
    create: {
      id: "gate-open",
      orgId: org.id,
      policyId: activePolicy.id,
      state: "OPEN",
      opensAt: new Date(),
      reason: "Normal operations",
    },
  });

  await prisma.gate.upsert({
    where: { id: "gate-closed" },
    update: {
      state: "CLOSED",
      policyId: closedPolicy.id,
      reason: "Policy sunset",
    },
    create: {
      id: "gate-closed",
      orgId: org.id,
      policyId: closedPolicy.id,
      state: "CLOSED",
      closesAt: new Date(),
      reason: "Policy sunset",
    },
  });

  const start = new Date();
  const bankLineData = Array.from({ length: 50 }, (_, index) => {
    const amountCents = 50_00 + index * 137;
    const entryDate = new Date(start);
    entryDate.setDate(entryDate.getDate() - (50 - index));
    return {
      id: `bank-line-${index + 1}`,
      orgId: org.id,
      date: entryDate,
      amount: (amountCents / 100).toFixed(2),
      payee: index % 2 === 0 ? "Supplier" : "Customer",
      desc: `Seeded line ${index + 1}`,
    } as const;
  });

  await prisma.bankLine.createMany({ data: bankLineData, skipDuplicates: true });

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
