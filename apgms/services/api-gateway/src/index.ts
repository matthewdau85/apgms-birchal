import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import dotenv from "dotenv";

import { decorateReplyWithSchema } from "./plugins/reply-schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const healthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
});

const userSummarySchema = z.object({
  email: z.string().email(),
  orgId: z.string(),
  createdAt: z.string(),
});

const usersResponseSchema = z.object({
  users: z.array(userSummarySchema),
});

const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amountCents: z.number().int().nonnegative(),
  payee: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

const bankLinesResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

type PrismaBankLineRecord = BankLineRecord & Record<string, unknown>;

type PrismaClientLike = {
  user: {
    findMany: (args: {
      select: { email: true; orgId: true; createdAt: true };
      orderBy: { createdAt: "desc" };
    }) => Promise<ReadonlyArray<UserRecord>>;
  };
  bankLine: {
    findMany: (args: { orderBy: { date: "desc" }; take: number }) => Promise<
      ReadonlyArray<PrismaBankLineRecord>
    >;
    create: (args: {
      data: {
        orgId: string;
        date: Date;
        amount: unknown;
        payee: string;
        desc: string;
      };
    }) => Promise<PrismaBankLineRecord>;
  };
};

export interface BuildAppOptions {
  prisma?: PrismaClientLike;
  logger?: boolean;
}

type UserRecord = {
  email: string;
  orgId: string;
  createdAt: Date | string;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date | string;
  amount: unknown;
  payee: string;
  desc: string;
  createdAt: Date | string;
};

const toISOString = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }

  throw new TypeError("Unsupported date value");
};

const toAmountCents = (amount: unknown) => {
  if (typeof amount === "number") {
    return Math.round(amount * 100);
  }

  if (typeof amount === "string") {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) {
      throw new TypeError("Invalid amount value");
    }
    return Math.round(numeric * 100);
  }

  if (amount && typeof amount === "object") {
    const candidate = amount as { toNumber?: () => number; valueOf?: () => unknown };
    if (typeof candidate.toNumber === "function") {
      return Math.round(candidate.toNumber() * 100);
    }
    if (typeof candidate.valueOf === "function") {
      const numeric = Number(candidate.valueOf());
      if (!Number.isFinite(numeric)) {
        throw new TypeError("Invalid amount value");
      }
      return Math.round(numeric * 100);
    }
  }

  throw new TypeError("Unsupported amount type");
};

const mapUser = (user: UserRecord) => ({
  email: user.email,
  orgId: user.orgId,
  createdAt: toISOString(user.createdAt),
});

const mapBankLine = (line: BankLineRecord) => ({
  id: line.id,
  orgId: line.orgId,
  date: toISOString(line.date),
  amountCents: toAmountCents(line.amount),
  payee: line.payee,
  description: line.desc,
  createdAt: toISOString(line.createdAt),
});

export const buildApp = async (
  { prisma, logger = true }: BuildAppOptions = {}
) => {
  const client =
    prisma ??
    ((await import("../../../shared/src/db")).prisma as PrismaClientLike);
  const app = Fastify({ logger });

  await app.register(cors, { origin: true });
  decorateReplyWithSchema(app);

  if (process.env.NODE_ENV !== "test") {
    app.ready(() => {
      app.log.info(app.printRoutes());
    });
  }

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async (_, reply) =>
    reply.withSchema(healthSchema, { ok: true, service: "api-gateway" })
  );

  app.get("/users", async (_, reply) => {
    const users = await client.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return reply.withSchema(usersResponseSchema, {
      users: users.map(mapUser),
    });
  });

  app.get("/bank-lines", async (req, reply) => {
    const rawTake = Number(
      (req.query as Record<string, unknown>).take ?? 20
    );
    const take = Number.isFinite(rawTake)
      ? Math.min(Math.max(rawTake, 1), 200)
      : 20;

    const lines = await client.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });

    return reply.withSchema(bankLinesResponseSchema, {
      lines: lines.map((line) => mapBankLine(line)),
    });
  });

  app.post("/bank-lines", async (req, reply) => {
    try {
      const body = req.body as {
        orgId: string;
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };

      const created = await client.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });

      return reply.code(201).withSchema(bankLineSchema, mapBankLine(created));
    } catch (error) {
      req.log.error(error);
      return reply.code(400).send({ error: "bad_request" });
    }
  });

  return app;
};

if (process.env.NODE_ENV !== "test") {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

