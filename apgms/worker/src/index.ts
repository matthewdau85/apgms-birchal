import path from "node:path";
import { fileURLToPath } from "node:url";

import { QueueScheduler, Worker } from "bullmq";
import dotenv from "dotenv";
import { BankFeedJobStatus } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { fetchStubBankTransactions, prisma } from "@apgms/shared";

const BANK_FEED_QUEUE = "bank-feed:poll";
const connection = {
  connectionString: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
};

new QueueScheduler(BANK_FEED_QUEUE, { connection })
  .waitUntilReady()
  .then(() => {
    console.log("Queue scheduler ready for", BANK_FEED_QUEUE);
  })
  .catch((err) => {
    console.error("Queue scheduler failed to start", err);
  });

const worker = new Worker(
  BANK_FEED_QUEUE,
  async (job) => {
    const orgId: string = job.data.orgId;
    const transactions = await fetchStubBankTransactions(orgId);

    let processed = 0;

    for (const tx of transactions) {
      await prisma.bankLine.upsert({
        where: {
          orgId_externalId: {
            orgId,
            externalId: tx.externalId,
          },
        },
        create: {
          orgId,
          externalId: tx.externalId,
          date: tx.date,
          amount: tx.amount,
          payee: tx.payee,
          desc: tx.desc,
        },
        update: {
          date: tx.date,
          amount: tx.amount,
          payee: tx.payee,
          desc: tx.desc,
        },
      });
      processed += 1;
    }

    await prisma.bankFeedJobRun.create({
      data: {
        orgId,
        status: BankFeedJobStatus.success,
        processedCount: processed,
      },
    });

    return { processed };
  },
  { connection },
);

worker.on("ready", () => {
  console.log("Bank feed worker ready");
});

worker.on("failed", async (job, err) => {
  if (!job) return;

  const attempts = job.opts?.attempts ?? 1;
  if (job.attemptsMade < attempts) {
    return;
  }

  const orgId: string | undefined = job.data?.orgId;
  if (!orgId) {
    return;
  }

  await prisma.bankFeedJobRun.create({
    data: {
      orgId,
      status: BankFeedJobStatus.failed,
      processedCount: 0,
      error: err?.message ?? "Unknown error",
    },
  });
});

worker.on("error", (err) => {
  console.error("Bank feed worker error", err);
});
