import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const apiKey = process.env.API_GATEWAY_API_KEY ?? "dev-api-key";

const requireApiKey = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.url === "/health") {
    return;
  }
  const headerKey = request.headers["x-api-key"];
  if (headerKey !== apiKey) {
    return reply
      .code(401)
      .send({ error: "unauthorized", message: "Missing or invalid API key" });
  }
};

app.addHook("onRequest", requireApiKey);

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (reply.statusCode >= 500) {
    return reply.send({ error: "internal_error" });
  }
  return reply.send(error);
});

const bankLineBodySchema = z.object({
  orgId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

const listBankLinesQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(20),
});

const decimalToNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    const maybeFn = (value as { toNumber?: () => number }).toNumber;
    if (typeof maybeFn === "function") {
      return maybeFn.call(value);
    }
  }
  return Number(value);
};

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
  };
});

// List bank lines (latest first)
app.get("/bank-lines", async (req) => {
  const { take } = listBankLinesQuerySchema.parse(req.query ?? {});
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take,
  });
  return {
    lines: lines.map((line) => ({
      ...line,
      date: line.date.toISOString(),
      amount: decimalToNumber(line.amount),
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    })),
  };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  const parsed = bankLineBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return rep.code(400).send({ error: "validation_error", issues: parsed.error.issues });
  }

  const { orgId, date, amount, payee, desc } = parsed.data;
  const created = await prisma.bankLine.create({
    data: {
      orgId,
      date,
      amount,
      payee,
      desc,
    },
  });
  return rep.code(201).send({
    bankLine: {
      ...created,
      date: created.date.toISOString(),
      amount: decimalToNumber(created.amount),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
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

