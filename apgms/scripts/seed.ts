import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const normalizeEnv = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

const rawEnv = process.env.SEED_ENV ?? process.env.NODE_ENV ?? "development";
const environment = (() => {
  const normalized = normalizeEnv(rawEnv);
  return normalized.length > 0 ? normalized : "development";
})();

if (environment === "production" && process.env.ALLOW_PROD_SEED !== "true") {
  console.error("Refusing to seed production environment. Set ALLOW_PROD_SEED=true to override.");
  process.exit(1);
}

const orgId = `demo-org-${environment}`;
const userEmail = `founder+${environment}@example.com`;

async function main() {
  const org = await prisma.org.upsert({
    where: { id: orgId },
    update: {},
    create: { id: orgId, name: `Demo Org (${environment})` },
  });

  await prisma.user.upsert({
    where: { email: userEmail },
    update: {},
    create: { email: userEmail, password: "password123", orgId: org.id },
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

  console.log(`Seed OK for ${environment}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
