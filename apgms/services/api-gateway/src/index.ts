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
import type { BankLine } from "@prisma/client";
import { prisma } from "../../../shared/src/db";

const CreateBankLineSchema = z.object({
  orgId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

const BankLineResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime(),
  amount: z.number(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime(),
});

const BankLineListSchema = z.object({
  lines: z.array(BankLineResponseSchema),
});

type BankLineResponse = z.infer<typeof BankLineResponseSchema>;

function serializeBankLine(line: BankLine): BankLineResponse {
  return BankLineResponseSchema.parse({
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: Number(line.amount),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  });
}

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
  return BankLineListSchema.parse({
    lines: lines.map(serializeBankLine),
  });
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  const parsedBody = CreateBankLineSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return rep.code(400).send({ errors: parsedBody.error.issues });
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
    return rep.code(201).send(serializeBankLine(created));
  } catch (e) {
    req.log.error(e);
    return rep.code(500).send({ error: "unexpected_error" });
  }
});

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info(app.printRoutes());
});

export { app };

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

