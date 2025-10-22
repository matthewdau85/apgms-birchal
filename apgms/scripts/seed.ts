import { PrismaClient } from "@prisma/client";
import { hash } from "@apgms/shared/src/crypto";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Demo Org" },
  });

  const passwordHash = await hash(process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!123");

  await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: { passwordHash },
    create: { email: "founder@example.com", passwordHash, orgId: org.id },
  });

  const today = new Date();
  await prisma.bankLine.createMany({
    data: [
      {
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
        amount: 1250.75,
        payee: "Acme",
        desc: "Office fit-out",
      },
      {
        orgId: org.id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
        amount: -299.99,
        payee: "CloudCo",
        desc: "Monthly sub",
      },
      {
        orgId: org.id,
        date: today,
        amount: 5000.0,
        payee: "Birchal",
        desc: "Investment received",
      },
    ],
    skipDuplicates: true,
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
