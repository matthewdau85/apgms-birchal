import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);

async function hashPassword(password: string): Promise<string> {
  const script = [
    "import crypt, sys",
    "salt = crypt.mksalt(crypt.METHOD_BLOWFISH, rounds=2**12)",
    "print(crypt.crypt(sys.argv[1], salt), end='')",
  ].join("\n");

  try {
    const { stdout } = await execFileAsync("python3", ["-c", script, password]);
    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to generate bcrypt hash: ${(error as Error).message}`);
  }
}

async function main() {
  const passwordHash = await hashPassword("password123");

  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Demo Org" },
  });

  await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: { password: passwordHash, orgId: org.id },
    create: { email: "founder@example.com", password: passwordHash, orgId: org.id },
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
