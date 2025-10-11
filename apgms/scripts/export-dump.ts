import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to export data");
  }

  const orgs = await prisma.org.findMany({
    include: {
      users: true,
      lines: true,
    },
  });

  const payload = orgs.map((org) => ({
    ...org,
    createdAt: org.createdAt.toISOString(),
    users: org.users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
    lines: org.lines.map((line) => ({
      ...line,
      amount: line.amount.toString(),
      date: line.date.toISOString(),
      createdAt: line.createdAt.toISOString(),
    })),
  }));

  const exportDir = path.resolve(process.cwd(), "exports");
  await fs.mkdir(exportDir, { recursive: true });
  const filePath = path.join(exportDir, `dump-${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Exported ${payload.length} organisation(s) to ${filePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
