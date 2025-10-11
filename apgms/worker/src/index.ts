import path from "node:path";

import dotenv from "dotenv";
import { prisma, seedDemoData } from "@apgms/shared";
import { z } from "zod";

const envFiles = [
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), ".env"),
];
for (const file of envFiles) {
  dotenv.config({ path: file });
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
});

const env = envSchema.parse(process.env);

await seedDemoData();

let lastSeenCreatedAt = new Date(0);

async function pollForNewBankLines() {
  const lines = await prisma.bankLine.findMany({
    where: { createdAt: { gt: lastSeenCreatedAt } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  if (lines.length === 0) {
    console.log(`[worker] no new bank lines found at ${new Date().toISOString()}`);
    return;
  }

  lastSeenCreatedAt = lines[lines.length - 1]!.createdAt;

  for (const line of lines) {
    console.log(
      `📒 [worker] org=${line.orgId} amount=${line.amount} payee=${line.payee} desc=${line.desc}`,
    );
  }
}

await pollForNewBankLines();

const interval = setInterval(() => {
  pollForNewBankLines().catch((error: unknown) => {
    console.error("[worker] failed to fetch bank lines", error);
  });
}, env.WORKER_INTERVAL_MS);

const shutdown = () => {
  clearInterval(interval);
  prisma
    .$disconnect()
    .catch((error: unknown) => {
      console.error("[worker] failed to disconnect prisma", error);
    })
    .finally(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
