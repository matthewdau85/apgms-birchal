import Fastify from "fastify";
import cors from "@fastify/cors";
import { Decimal } from "@prisma/client/runtime/library";

import { replyValidate } from "./lib/reply.js";
import { zDateISO, zOrgId } from "./schemas/common.js";
import {
  createBankLineBodySchema,
  createBankLineResponseSchema,
  listBankLinesQuerySchema,
  listBankLinesResponseSchema,
} from "./schemas/bank-lines.js";
import { z } from "zod";

type DecimalLike = { toNumber: () => number };

type UserRecord = {
  email: string;
  orgId: string;
  createdAt: Date;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: DecimalLike;
  payee: string;
  desc: string;
  createdAt: Date;
};

type PrismaLike = {
  user: {
    findMany: (args: {
      select: { email: true; orgId: true; createdAt: true };
      orderBy: { createdAt: "desc" | "asc" };
    }) => Promise<UserRecord[]>;
  };
  bankLine: {
    findMany: (args: {
      orderBy: { date: "desc" | "asc" };
      take: number;
      skip?: number;
      cursor?: { id: string };
    }) => Promise<BankLineRecord[]>;
    create: (args: {
      data: {
        orgId: string;
        date: Date;
        amount: DecimalLike;
        payee: string;
        desc: string;
      };
    }) => Promise<BankLineRecord>;
  };
};

export type BuildAppDependencies = {
  prisma: PrismaLike;
};

const resolveDependencies = async (
  deps?: BuildAppDependencies,
): Promise<BuildAppDependencies> => {
  if (deps) {
    return deps;
  }

  const shared = await import("../../../shared/src/db.js");
  return { prisma: shared.prisma as PrismaLike };
};

export const buildApp = async (deps?: BuildAppDependencies) => {
  const resolvedDeps = await resolveDependencies(deps);
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  const healthResponseSchema = z.object({
    ok: z.literal(true),
    service: z.string(),
  });

  app.get("/health", async () =>
    replyValidate(healthResponseSchema)({ ok: true, service: "api-gateway" }),
  );

  const userSchema = z.object({
    email: z.string().email(),
    orgId: zOrgId,
    createdAt: zDateISO,
  });

  const usersResponseSchema = z.object({
    users: z.array(userSchema),
  });

  app.get("/users", async () => {
    const users = await resolvedDeps.prisma.user.findMany({
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

    return replyValidate(usersResponseSchema)(payload);
  });

  app.get("/bank-lines", async (req) => {
    const query = listBankLinesQuerySchema.parse(req.query ?? {});
    const take = query.take ?? 20;

    const records = await resolvedDeps.prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: take + 1,
      skip: query.cursor ? 1 : undefined,
      cursor: query.cursor ? { id: query.cursor } : undefined,
    });

    const nextCursor = records.length > take ? records[take].id : null;

    const lines = records.slice(0, take).map((line) => ({
      id: line.id,
      orgId: line.orgId,
      date: line.date.toISOString(),
      amountCents: Math.round(line.amount.toNumber() * 100),
      payee: line.payee,
      desc: line.desc,
      createdAt: line.createdAt.toISOString(),
    }));

    return replyValidate(listBankLinesResponseSchema)({
      lines,
      nextCursor,
    });
  });

  app.post("/bank-lines", async (req, rep) => {
    const parsed = createBankLineBodySchema.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ error: parsed.error }, "invalid request body");
      return rep.code(400).send({ error: "bad_request" });
    }

    const { date, amountCents, ...rest } = parsed.data;
    const amountDecimal = new Decimal(amountCents).dividedBy(100);

    const created = await resolvedDeps.prisma.bankLine.create({
      data: {
        ...rest,
        date,
        amount: amountDecimal,
      },
    });

    const response = replyValidate(createBankLineResponseSchema)({
      id: created.id,
      orgId: created.orgId,
      date: created.date.toISOString(),
      amountCents: Math.round(created.amount.toNumber() * 100),
      payee: created.payee,
      desc: created.desc,
      createdAt: created.createdAt.toISOString(),
    });

    return rep.code(201).send(response);
  });

  return app;
};
