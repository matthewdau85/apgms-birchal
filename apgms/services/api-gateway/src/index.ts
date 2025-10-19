import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/src/db";
import authPlugin from "./plugins/auth";
import orgScopeHook from "./hooks/org-scope";

type BankLineCreateBody = {
  date: string;
  amount: number | string;
  payee: string;
  desc: string;
};

type BankLineQuery = {
  take?: string;
};

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(authPlugin);
await app.register(orgScopeHook);

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", { config: { public: true } }, async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async (request) => {
  if (!request.orgId) {
    throw new Error("Missing organisation context");
  }

  const users = await prisma.user.findMany({
    where: { orgId: request.orgId },
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (request) => {
  if (!request.orgId) {
    throw new Error("Missing organisation context");
  }

  const take = Number((request.query as BankLineQuery).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    where: { orgId: request.orgId },
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (request, reply) => {
  if (!request.orgId) {
    throw new Error("Missing organisation context");
  }

  try {
    const body = request.body as BankLineCreateBody;
    const created = await prisma.bankLine.create({
      data: {
        orgId: request.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });
    return reply.code(201).send(created);
  } catch (e) {
    request.log.error(e);
    return reply.code(400).send({ error: "bad_request" });
  }
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
