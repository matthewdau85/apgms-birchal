import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgs = [
    { id: "org-birchal", name: "Birchal" },
    { id: "org-acme", name: "Acme Industries" },
  ];

  await Promise.all(
    orgs.map((org) =>
      prisma.org.upsert({
        where: { id: org.id },
        update: { name: org.name },
        create: org,
      })
    )
  );

  const users = [
    {
      id: "user-alex",
      email: "alex@birchal.com",
      password: "password123",
      orgId: "org-birchal",
    },
    {
      id: "user-sam",
      email: "sam@birchal.com",
      password: "password123",
      orgId: "org-birchal",
    },
    {
      id: "user-taylor",
      email: "taylor@acme.co",
      password: "changeme",
      orgId: "org-acme",
    },
  ];

  await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: { orgId: user.orgId },
        create: user,
      })
    )
  );

  const today = new Date();
  const bankLines = [
    {
      id: "line-birchal-1",
      orgId: "org-birchal",
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5),
      amount: new Prisma.Decimal("1250.75"),
      payee: "Acme Fitouts",
      desc: "Office fit-out",
    },
    {
      id: "line-birchal-2",
      orgId: "org-birchal",
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
      amount: new Prisma.Decimal("-299.99"),
      payee: "CloudCo",
      desc: "Monthly subscription",
    },
    {
      id: "line-acme-1",
      orgId: "org-acme",
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
      amount: new Prisma.Decimal("5200"),
      payee: "Birchal",
      desc: "Investment received",
    },
  ];

  await Promise.all(
    bankLines.map((line) =>
      prisma.bankLine.upsert({
        where: { id: line.id },
        update: {
          amount: line.amount,
          payee: line.payee,
          desc: line.desc,
          date: line.date,
        },
        create: line,
      })
    )
  );

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
