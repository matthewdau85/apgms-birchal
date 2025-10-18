import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";
import replySchemaPlugin from "./plugins/reply-schema";
import { listUsersResponseSchema, type ListUsersResponse } from "./schemas/users";
import {
  listBankLinesResponseSchema,
  createBankLineResponseSchema,
  createBankLineRequestSchema,
  type ListBankLinesResponse,
  type CreateBankLineResponse,
  type CreateBankLineRequest,
} from "./schemas/bank-lines";
import { healthResponseSchema, type HealthResponse } from "./schemas/dashboard";

type PrismaLike = Pick<PrismaClient, "user" | "bankLine">;

let cachedPrisma: PrismaLike | null = null;

async function resolvePrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = await import("@apgms/shared/src/db");
    cachedPrisma = module.prisma;
  }
  return cachedPrisma;
}

export interface BuildAppOptions {
  prismaClient?: PrismaLike;
  logger?: boolean;
}

const defaultOptions: Required<Omit<BuildAppOptions, "prismaClient">> = {
  logger: true,
};

function toISOString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function toAmountCents(value: unknown): number {
  let numeric: number | null = null;

  if (value && typeof value === "object") {
    if ("toNumber" in value && typeof (value as any).toNumber === "function") {
      numeric = (value as any).toNumber();
    } else if ("toJSON" in value && typeof (value as any).toJSON === "function") {
      const jsonValue = (value as any).toJSON();
      if (typeof jsonValue === "number") {
        numeric = jsonValue;
      } else if (typeof jsonValue === "string") {
        const parsed = Number(jsonValue);
        if (Number.isFinite(parsed)) {
          numeric = parsed;
        }
      }
    }
  }

  if (numeric === null) {
    if (typeof value === "number") {
      numeric = value;
    } else if (typeof value === "bigint") {
      numeric = Number(value);
    } else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        numeric = parsed;
      }
    }
  }

  if (!Number.isFinite(numeric)) {
    throw new TypeError("Unable to convert amount to cents");
  }

  return Math.trunc(numeric as number);
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { logger } = { ...defaultOptions, ...options };
  const prisma = options.prismaClient ?? (await resolvePrisma());

  const app = Fastify({ logger });

  await app.register(cors, { origin: true });
  await app.register(replySchemaPlugin);

  app.get("/health", async (_req, reply) => {
    const payload: HealthResponse = { ok: true, service: "api-gateway" };
    reply.withSchema(healthResponseSchema, payload);
    return reply;
  });

  app.get("/users", async (_req, reply) => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const payload: ListUsersResponse = {
      users: users.map((user) => ({
        email: user.email,
        orgId: user.orgId,
        createdAt: toISOString(user.createdAt),
      })),
    };

    reply.withSchema(listUsersResponseSchema, payload);
    return reply;
  });

  app.get("/bank-lines", async (req, reply) => {
    const query = req.query as { take?: number | string } | undefined;
    const takeRaw = query?.take ?? 20;
    const parsedTake = Number(takeRaw);
    const safeTake = Number.isFinite(parsedTake) ? parsedTake : 20;
    const take = Math.min(Math.max(Math.trunc(safeTake), 1), 200);

    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });

    const payload: ListBankLinesResponse = {
      lines: lines.map((line) => ({
        id: line.id,
        orgId: line.orgId,
        date: toISOString(line.date),
        amountCents: toAmountCents((line as any).amount ?? (line as never)),
        payee: line.payee,
        desc: line.desc,
        createdAt: toISOString(line.createdAt),
      })),
    };

    reply.withSchema(listBankLinesResponseSchema, payload);
    return reply;
  });

  app.post("/bank-lines", async (req, reply) => {
    const parseResult = createBankLineRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      req.log.error({ err: parseResult.error }, "invalid create bank line payload");
      return reply.code(400).send({ error: "bad_request" });
    }

    const body: CreateBankLineRequest = parseResult.data;

    try {
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amountCents,
          payee: body.payee,
          desc: body.desc,
        },
      });

      const payload: CreateBankLineResponse = {
        id: created.id,
        orgId: created.orgId,
        date: toISOString(created.date),
        amountCents: toAmountCents((created as any).amount ?? (created as never)),
        payee: created.payee,
        desc: created.desc,
        createdAt: toISOString(created.createdAt),
      };

      reply.code(201);
      reply.withSchema(createBankLineResponseSchema, payload);
      return reply;
    } catch (e) {
      req.log.error({ err: e }, "failed to create bank line");
      return reply.code(400).send({ error: "bad_request" });
    }
  });

  return app;
}

