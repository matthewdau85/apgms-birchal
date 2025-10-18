import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { apiKeyAuthPlugin } from "../../../shared/src/auth";
import { prisma } from "../../../shared/src/db";

const DEFAULT_BANK_LINE_LIMIT = 20;

const bankLineQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const createBankLineSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  date: z.coerce.date({ required_error: "date is required" }),
  amount: z.coerce.number({ required_error: "amount is required" }),
  payee: z.string().min(1, "payee is required"),
  desc: z.string().min(1, "desc is required"),
});

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(apiKeyAuthPlugin, {
  exemptRoutes: ["/health"],
});

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
  const { take } = bankLineQuerySchema.parse(req.query ?? {});
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: take ?? DEFAULT_BANK_LINE_LIMIT,
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  const parsedBody = createBankLineSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return rep.code(400).send({
      error: "bad_request",
      message: "Invalid bank line payload",
      issues: parsedBody.error.format(),
    });
  }

  const { orgId, date, amount, payee, desc } = parsedBody.data;

  try {
    const created = await prisma.bankLine.create({
      data: {
        orgId,
        date,
        amount,
        payee,
        desc,
      },
    });
    return rep.code(201).send(created);
  } catch (e) {
    req.log.error(e);
    return rep.code(500).send({ error: "internal_error" });
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
