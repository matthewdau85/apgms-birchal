import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import dotenv from "dotenv";

import {
  BASELINE_DATA,
  ensureDatabaseConnection,
  runWithPrisma,
} from "../shared/src/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

type UpsertOrg = (typeof BASELINE_DATA.orgs)[number];
type UpsertUser = (typeof BASELINE_DATA.users)[number];
type CreateBankLine = (typeof BASELINE_DATA.bankLines)[number];

async function seedOrgs(orgs: UpsertOrg[]): Promise<void> {
  for (const org of orgs) {
    await runWithPrisma((client) =>
      client.org.upsert({
        where: { id: org.id },
        create: org,
        update: { name: org.name },
      }),
    );
  }
}

async function seedUsers(users: UpsertUser[]): Promise<void> {
  for (const user of users) {
    await runWithPrisma((client) =>
      client.user.upsert({
        where: { email: user.email },
        create: user,
        update: { password: user.password, orgId: user.orgId },
      }),
    );
  }
}

async function seedBankLines(lines: CreateBankLine[]): Promise<void> {
  if (!lines.length) {
    return;
  }

  const payload = lines.map((line) => ({
    ...line,
    date: new Date(line.date),
  }));

  await runWithPrisma((client) =>
    client.bankLine.createMany({
      data: payload,
      skipDuplicates: true,
    }),
  );
}

async function main(): Promise<void> {
  await ensureDatabaseConnection();

  await seedOrgs(BASELINE_DATA.orgs);
  await seedUsers(BASELINE_DATA.users);
  await seedBankLines(BASELINE_DATA.bankLines);

  console.log(
    `Seed complete for ${BASELINE_DATA.orgs.length} orgs, ${BASELINE_DATA.users.length} users, and ${BASELINE_DATA.bankLines.length} bank lines.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const client = await ensureDatabaseConnection();
      await client.$disconnect();
    } catch (error) {
      console.error("Failed to disconnect Prisma client after seed", error);
    }
  });
