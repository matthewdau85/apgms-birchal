import { prisma } from "../src/db.js";

async function seed() {
  await prisma.bankLine.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();

  const [acme, birchal] = await Promise.all([
    prisma.org.create({
      data: {
        name: "Acme Capital",
      },
    }),
    prisma.org.create({
      data: {
        name: "Birchal Ventures",
      },
    }),
  ]);

  await prisma.user.createMany({
    data: [
      {
        email: "sam@acme.test",
        password: "password123",
        orgId: acme.id,
      },
      {
        email: "jordan@birchal.test",
        password: "password123",
        orgId: birchal.id,
      },
    ],
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  await prisma.bankLine.createMany({
    data: [
      {
        orgId: acme.id,
        date: today,
        amount: 12_500,
        payee: "Marketing Hub",
        desc: "Monthly subscription",
      },
      {
        orgId: acme.id,
        date: yesterday,
        amount: -3_250.45,
        payee: "Acme Payroll",
        desc: "Payroll run",
      },
      {
        orgId: birchal.id,
        date: today,
        amount: 8_450,
        payee: "Angel Syndicate",
        desc: "Seed investment",
      },
    ],
  });
}

seed()
  .then(() => {
    console.info("Seed data applied successfully");
  })
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
