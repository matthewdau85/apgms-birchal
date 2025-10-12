import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Queue } from "bullmq";
import { prisma } from "@apgms/shared";

const BANK_FEED_QUEUE = "bank-feed:poll";

const redisConnection = {
  connection: {
    connectionString: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  },
};

const bankFeedQueue = new Queue(BANK_FEED_QUEUE, redisConnection);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  try {
    const body = req.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
      externalId?: string;
    };
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        externalId: body.externalId ?? undefined,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });
    return rep.code(201).send(created);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.post("/jobs/poll-now", async (req, rep) => {
  const orgId = (req.query as Record<string, string | undefined>).orgId;
  if (!orgId) {
    return rep.code(400).send({ error: "orgId_required" });
  }

  const orgExists = await prisma.org.findUnique({ select: { id: true }, where: { id: orgId } });
  if (!orgExists) {
    return rep.code(404).send({ error: "org_not_found" });
  }

  try {
    const job = await bankFeedQueue.add(
      "poll",
      { orgId },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return { jobId: job.id, state: "queued" };
  } catch (err) {
    req.log.error({ err, orgId }, "failed_to_enqueue_poll_job");
    return rep.code(500).send({ error: "queue_failure" });
  }
});

app.get("/jobs/status", async () => {
  const lastRun = await prisma.bankFeedJobRun.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return { queue: BANK_FEED_QUEUE, lastRun };
});

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

