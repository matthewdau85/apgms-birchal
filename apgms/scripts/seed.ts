import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedGates() {
  const gates = [
    {
      id: "gate-kyc",
      key: "kyc-verification",
      name: "KYC Verification",
      description: "Ensures all investor identities are verified before approval.",
    },
    {
      id: "gate-aml",
      key: "aml-screening",
      name: "AML Screening",
      description: "Flags transactions against AML rule sets.",
    },
    {
      id: "gate-risk",
      key: "risk-threshold",
      name: "Risk Threshold",
      description: "Applies portfolio exposure limits before reconciliation.",
    },
  ];

  await Promise.all(
    gates.map((gate) =>
      prisma.gate.upsert({
        where: { key: gate.key },
        update: {
          name: gate.name,
          description: gate.description,
        },
        create: {
          id: gate.id,
          key: gate.key,
          name: gate.name,
          description: gate.description,
        },
      })
    )
  );
}

async function attachGatesToPolicy(policyId: string, gateKeys: string[]) {
  const gates = await prisma.gate.findMany({ where: { key: { in: gateKeys } } });
  const order = new Map(gateKeys.map((key, index) => [key, index] as const));
  const sorted = gates.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

  await Promise.all(
    sorted.map((gate, index) =>
      prisma.policyGate.upsert({
        where: { id: `${policyId}-${gate.id}` },
        update: { sequence: index },
        create: {
          id: `${policyId}-${gate.id}`,
          policyId,
          gateId: gate.id,
          sequence: index,
        },
      })
    )
  );
}

async function seedPolicies(orgId: string) {
  const policy = await prisma.policy.upsert({
    where: { id: "policy-standard-recon" },
    update: {
      name: "Standard Reconciliation",
      description: "Default control gates applied to nightly reconciliations.",
      isActive: true,
    },
    create: {
      id: "policy-standard-recon",
      orgId,
      name: "Standard Reconciliation",
      description: "Default control gates applied to nightly reconciliations.",
      isActive: true,
    },
  });

  await attachGatesToPolicy(policy.id, ["kyc-verification", "aml-screening", "risk-threshold"]);

  await prisma.reconciliationPassToken.upsert({
    where: { token: "demo-pass-token" },
    update: {
      policyId: policy.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
    create: {
      id: "token-demo",
      policyId: policy.id,
      token: "demo-pass-token",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  await prisma.auditTrail.upsert({
    where: { id: "audit-policy-standard-recon" },
    update: {
      entityType: "Policy",
      entityId: policy.id,
      action: "SEED_SYNC",
      metadata: {
        note: "Policy refreshed during seed",
      },
    },
    create: {
      id: "audit-policy-standard-recon",
      orgId,
      entityType: "Policy",
      entityId: policy.id,
      action: "SEED_CREATE",
      metadata: {
        note: "Policy created during initial seed",
      },
    },
  });
}

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
      { orgId: org.id, date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2), amount: 1250.75, payee: "Acme", desc: "Office fit-out" },
      { orgId: org.id, date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), amount: -299.99, payee: "CloudCo", desc: "Monthly sub" },
      { orgId: org.id, date: today, amount: 5000.0, payee: "Birchal", desc: "Investment received" },
    ],
    skipDuplicates: true,
  });

  await seedGates();
  await seedPolicies(org.id);

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
