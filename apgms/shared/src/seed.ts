import { prisma } from "./db.js";

export async function seedDemoData() {
  const existingOrgs = await prisma.org.count();
  if (existingOrgs > 0) {
    return;
  }

  const acme = await prisma.org.create({
    data: {
      name: "Acme Pty Ltd",
      users: {
        create: [
          {
            email: "alice@example.com",
            password: "password123",
          },
          {
            email: "bob@example.com",
            password: "password123",
          },
        ],
      },
    },
  });

  await prisma.bankLine.createMany({
    data: [
      {
        orgId: acme.id,
        date: new Date(),
        amount: 1250.45,
        payee: "Figma",
        desc: "Design subscription",
      },
      {
        orgId: acme.id,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
        amount: -350.0,
        payee: "AWS",
        desc: "Monthly infrastructure",
      },
      {
        orgId: acme.id,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
        amount: 9500,
        payee: "Invoice #1045",
        desc: "Consulting services",
      },
    ],
  });
}
