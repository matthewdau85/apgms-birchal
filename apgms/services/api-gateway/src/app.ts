import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  zBankLineCreateReq,
  zBankLineListQuery,
  zBankLineListRes,
  zBankLineRes,
} from "./schemas/bankLines";
import { validateReply } from "./lib/validate";

export type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: { toString(): string };
  payee: string;
  desc: string;
  createdAt: Date;
};

export type PrismaLike = {
  user: {
    findMany: (args: {
      select: { email: true; orgId: true; createdAt: true };
      orderBy: { createdAt: "desc" };
    }) => Promise<Array<{ email: string; orgId: string; createdAt: Date }>>;
  };
  bankLine: {
    findMany: (args: {
      orderBy: { date: "desc" };
      take: number;
    }) => Promise<BankLineRecord[]>;
    create: (args: {
      data: {
        orgId: string;
        date: Date;
        amount: string;
        payee: string;
        desc: string;
      };
    }) => Promise<BankLineRecord>;
  };
};

export const formatBankLine = (line: BankLineRecord) => {
  const amountCents = Number(line.amount.toString());

  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error(`Invalid amount for bank line ${line.id}`);
  }

  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amountCents,
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
};

export const createApp = async ({ prisma }: { prisma: PrismaLike }) => {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req, rep) => {
    const queryResult = zBankLineListQuery.safeParse(req.query);

    if (!queryResult.success) {
      return rep.code(400).send({
        error: "invalid_query",
        details: queryResult.error.flatten(),
      });
    }

    const take = queryResult.data.take ?? 20;
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });

    const payload = {
      lines: lines.map((line) => formatBankLine(line)),
    };

    return validateReply(zBankLineListRes, payload);
  });

  app.post("/bank-lines", async (req, rep) => {
    const bodyResult = zBankLineCreateReq.safeParse(req.body);

    if (!bodyResult.success) {
      return rep.code(400).send({
        error: "invalid_body",
        details: bodyResult.error.flatten(),
      });
    }

    try {
      const data = bodyResult.data;
      const created = await prisma.bankLine.create({
        data: {
          orgId: data.orgId,
          date: new Date(data.date),
          amount: data.amountCents.toString(),
          payee: data.payee,
          desc: data.desc,
        },
      });

      const payload = validateReply(zBankLineRes, formatBankLine(created));
      return rep.code(201).send(payload);
    } catch (e) {
      req.log.error(e);
      return rep.code(500).send({ error: "internal_error" });
    }
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};
