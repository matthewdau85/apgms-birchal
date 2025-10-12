import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export interface PrismaClientLike {
  user: {
    findMany: (args: {
      select: { email: true; orgId: true; createdAt: true };
      orderBy: { createdAt: "desc" };
    }) => Promise<unknown[]>;
  };
  bankLine: {
    findMany: (args: {
      orderBy: { date: "desc" };
      take: number;
    }) => Promise<unknown[]>;
    create: (args: {
      data: {
        orgId: string;
        date: Date;
        amount: unknown;
        payee: string;
        desc: string;
      };
    }) => Promise<unknown>;
  };
}

interface CreateAppOptions {
  prisma: PrismaClientLike;
}

interface PrismaErrorMapping {
  status: number;
  body: { error: string };
}

const isPrismaKnownRequestError = (error: unknown): error is { code: string } => {
  return typeof error === "object" && error !== null && "code" in error;
};

const mapPrismaError = (error: unknown): PrismaErrorMapping | null => {
  if (!isPrismaKnownRequestError(error)) {
    return null;
  }

  switch (error.code) {
    case "P2002":
      return { status: 409, body: { error: "conflict" } };
    case "P2025":
      return { status: 404, body: { error: "not_found" } };
    default:
      return null;
  }
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const parseAmount = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
};

const isValidDate = (value: unknown): boolean => {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
};

export const createApp = async ({ prisma }: CreateAppOptions): Promise<FastifyInstance> => {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as Record<string, unknown>).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const errors: string[] = [];

    if (!isNonEmptyString(body["orgId"])) {
      errors.push("orgId");
    }

    if (!isValidDate(body["date"])) {
      errors.push("date");
    }

    const parsedAmount = parseAmount(body["amount"]);
    if (!Number.isFinite(parsedAmount)) {
      errors.push("amount");
    }

    if (!isNonEmptyString(body["payee"])) {
      errors.push("payee");
    }

    if (!isNonEmptyString(body["desc"])) {
      errors.push("desc");
    }

    if (errors.length > 0) {
      return rep.code(422).send({ error: "validation_failed", fields: errors });
    }

    try {
      const created = await prisma.bankLine.create({
        data: {
          orgId: body["orgId"] as string,
          date: new Date(body["date"] as string),
          amount: body["amount"],
          payee: body["payee"] as string,
          desc: body["desc"] as string,
        },
      });
      return rep.code(201).send(created);
    } catch (error) {
      const mapped = mapPrismaError(error);
      if (mapped) {
        return rep.code(mapped.status).send(mapped.body);
      }

      req.log.error(error);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  return app;
};

export type { FastifyInstance };
