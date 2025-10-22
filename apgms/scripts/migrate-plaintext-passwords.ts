import { randomBytes } from "node:crypto";

import { prisma } from "@apgms/shared/src/db";
import { hash } from "@apgms/shared/src/crypto";

async function hasLegacyPasswordColumn(): Promise<boolean> {
  const result = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'User'
        AND column_name = 'password'
    ) AS "exists";
  `;

  return result[0]?.exists ?? false;
}

async function loadLegacyPasswords(): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<{ id: string; password: string | null }[]>`
    SELECT "id", "password"
    FROM "User";
  `;

  const entries = rows
    .filter((row) => typeof row.password === "string" && row.password.trim().length > 0)
    .map((row) => [row.id, row.password!.trim()] as const);

  return new Map(entries);
}

async function main(): Promise<void> {
  const legacyColumnPresent = await hasLegacyPasswordColumn();
  const legacyPasswords = legacyColumnPresent ? await loadLegacyPasswords() : new Map();

  const usersNeedingHash = await prisma.user.findMany({
    where: { passwordHash: "" },
    select: { id: true, email: true },
  });

  if (usersNeedingHash.length === 0) {
    console.log("No plaintext passwords detected; nothing to migrate.");
    return;
  }

  let migratedCount = 0;
  let resetCount = 0;

  for (const user of usersNeedingHash) {
    const legacyPassword = legacyPasswords.get(user.id);
    let passwordHash: string;

    if (legacyPassword) {
      passwordHash = await hash(legacyPassword);
      migratedCount += 1;
    } else {
      const temporaryPassword = randomBytes(24).toString("base64url");
      passwordHash = await hash(temporaryPassword);
      resetCount += 1;
      console.warn(
        `User ${user.email} (${user.id}) is missing a legacy password; generated a temporary hash and requires reset.`,
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  if (legacyColumnPresent) {
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "password"');
      console.log("Dropped legacy plaintext password column.");
    } catch (error) {
      console.warn("Failed to drop legacy password column; please remove manually.", error);
    }
  }

  console.log(`Migrated ${migratedCount} accounts; flagged ${resetCount} for forced reset.`);
}

main()
  .catch((error) => {
    console.error("Failed to migrate plaintext passwords", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
