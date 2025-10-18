import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { dashboardResponseSchema } from "./schemas/dashboard";
import {
  createBankLineBodySchema,
  createBankLineResponseSchema,
  listBankLinesQuerySchema,
  listBankLinesResponseSchema,
} from "./schemas/bank-lines";
import { listUsersResponseSchema } from "./schemas/users";

const app = Fastify({ logger: true });

const isProduction = process.env.NODE_ENV === "production";

declare module "fastify" {
  interface FastifyReply {
    withSchema<T extends ZodTypeAny>(schema: T): FastifyReply & {
      send(payload: ZodInfer<T>): FastifyReply;
    };
  }
}

app.decorateReply("withSchema", function withSchema(this: FastifyReply, schema: ZodTypeAny) {
  const reply = this;
  const originalSend = reply.send.bind(reply);

  reply.send = function sendWithSchema(payload: unknown) {
    if (isProduction) {
      try {
        schema.parse(payload);
      } catch (error) {
        reply.log.error({ error, payload }, "Response schema validation failed");
      }
    } else {
      schema.parse(payload);
    }

    return originalSend(payload);
  };

  return reply;
});

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async (_, reply) => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const payload = {
    users: users.map((user) => ({
      email: user.email,
      orgId: user.orgId,
      createdAt: user.createdAt.toISOString(),
    })),
  };

  return reply.withSchema(listUsersResponseSchema).send(payload);
});

// List bank lines (latest first)
app.get("/bank-lines", async (req, reply) => {
  const parsedQuery = createBankLinesQuery(req.query as Record<string, unknown>);
  const take = parsedQuery.take ?? 20;
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });

  const payload = {
    lines: lines.map((line) => serializeBankLine(line)),
  };

  return reply.withSchema(listBankLinesResponseSchema).send(payload);
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  try {
    const body = createBankLineBodySchema.parse(req.body);
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount,
        payee: body.payee,
        desc: body.desc,
      },
    });
    const payload = serializeBankLine(created);
    return rep.code(201).withSchema(createBankLineResponseSchema).send(payload);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.get("/dashboard", async (_, reply) => {
  const [userCount, bankLineCount, sum, recentBankLines] = await Promise.all([
    prisma.user.count(),
    prisma.bankLine.count(),
    prisma.bankLine.aggregate({ _sum: { amount: true } }),
    prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  const payload = {
    totals: {
      users: userCount,
      bankLines: bankLineCount,
      balance: sum._sum.amount?.toString() ?? "0",
    },
    recentBankLines: recentBankLines.map((line) => serializeBankLine(line)),
  };

  return reply.withSchema(dashboardResponseSchema).send(payload);
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

type BankLine = Awaited<ReturnType<typeof prisma.bankLine.findFirst>>;

function serializeBankLine(line: NonNullable<BankLine>) {
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: String(line.amount),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
}

function createBankLinesQuery(query: Record<string, unknown> | undefined) {
  const parsed = listBankLinesQuerySchema.safeParse(query ?? {});
  return parsed.success ? parsed.data : {};
}

