import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";

type UserRecord = {
  email: string;
  orgId: string;
  createdAt: Date;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
};

type FindManyArgs<T> = {
  orderBy?: Partial<Record<keyof T, "asc" | "desc">>;
  select?: Partial<Record<keyof T, boolean>>;
  take?: number;
};

type CreateArgs<T> = {
  data: T;
};

export interface PrismaLikeClient {
  user: {
    findMany(args: FindManyArgs<UserRecord>): Promise<UserRecord[]>;
  };
  bankLine: {
    findMany(args: FindManyArgs<BankLineRecord>): Promise<BankLineRecord[]>;
    create(args: CreateArgs<
      Pick<BankLineRecord, "orgId" | "date" | "amount" | "payee" | "desc">
    >): Promise<BankLineRecord>;
  };
}

export interface CreateAppOptions {
  prisma: PrismaLikeClient;
  logger?: FastifyServerOptions["logger"];
}

export async function createApp({
  prisma,
  logger = true,
}: CreateAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
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
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: Number(body.amount),
          payee: body.payee,
          desc: body.desc,
        },
      });
      return rep.code(201).send(created);
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
