import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import type { FastifyServerOptions } from "fastify";
import { replyValidate } from "./lib/replyValidate";

const healthReply = replyValidate(
  z.object({
    ok: z.literal(true),
    service: z.literal("api-gateway"),
  })
);

const usersReply = replyValidate(
  z.object({
    users: z.array(
      z.object({
        email: z.string().email(),
        orgId: z.string(),
        createdAt: z.string(),
      })
    ),
  })
);

const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.string(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string(),
});

const bankLinesReply = replyValidate(
  z.object({
    lines: z.array(bankLineSchema),
  })
);

const bankLineReply = replyValidate(bankLineSchema);

const errorReply = replyValidate(
  z.object({
    error: z.string(),
  })
);

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: { toString(): string } | string | number;
  payee: string;
  desc: string;
  createdAt: Date;
};

type Dependencies = {
  prisma: {
    user: {
      findMany: (...args: any[]) => Promise<Array<{ email?: string; orgId: string; createdAt: Date }>>;
    };
    bankLine: {
      findMany: (...args: any[]) => Promise<BankLineRecord[]>;
      create: (...args: any[]) => Promise<BankLineRecord>;
    };
  };
};

const bankLineToReply = (line: BankLineRecord) => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date.toISOString(),
  amount: typeof line.amount === "object" && line.amount !== null && "toString" in line.amount
    ? line.amount.toString()
    : String(line.amount),
  payee: line.payee,
  desc: line.desc,
  createdAt: line.createdAt.toISOString(),
});

const resolvePrisma = async (deps?: Dependencies) => {
  if (deps) {
    return deps.prisma;
  }

  const { prisma } = await import("../../../shared/src/db");
  return prisma as Dependencies["prisma"];
};

export const buildApp = async (
  options: FastifyServerOptions = { logger: true },
  deps?: Dependencies
) => {
  const db = await resolvePrisma(deps);

  const app = Fastify(options);

  await app.register(cors, { origin: true });

  app.get("/health", async () => healthReply({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await db.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return usersReply({
      users: users.map(({ email, orgId, createdAt }) => ({
        email: email ?? "",
        orgId,
        createdAt: createdAt.toISOString(),
      })),
    });
  });

  app.get("/bank-lines", async (req) => {
    const takeParam = Number((req.query as { take?: string | number }).take ?? 20);
    const take = Number.isFinite(takeParam) ? takeParam : 20;

    const lines = await db.bankLine.findMany({
      select: {
        id: true,
        orgId: true,
        date: true,
        amount: true,
        payee: true,
        desc: true,
        createdAt: true,
      },
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });

    return bankLinesReply({
      lines: lines.map(bankLineToReply),
    });
  });

  app.post("/bank-lines", async (req, rep) => {
    try {
      const body = req.body as {
        orgId: string;
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };
      const created = await db.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
        select: {
          id: true,
          orgId: true,
          date: true,
          amount: true,
          payee: true,
          desc: true,
          createdAt: true,
        },
      });

      return rep.code(201).send(bankLineReply(bankLineToReply(created)));
    } catch (e) {
      req.log.error(e);
      return rep.code(400).send(errorReply({ error: "bad_request" }));
    }
  });

  return app;
};
