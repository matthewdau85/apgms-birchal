import Fastify, { type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import type { PrismaClient, BankLine, User } from "@prisma/client";
import {
  createBankLineRequestSchema,
  createBankLineResponseSchema,
  listBankLinesQuerySchema,
  listBankLinesResponseSchema,
  listUsersResponseSchema,
  type CreateBankLineRequest,
  type CreateBankLineResponse,
  type ListBankLinesQuery,
  type ListBankLinesResponse,
  type ListUsersResponse,
  withSchema,
} from "./schemas";

type Dependencies = {
  prisma: PrismaClient;
};

type BankLineRecord = Pick<BankLine, "id" | "orgId" | "date" | "amount" | "payee" | "desc" | "createdAt">;
type UserRecord = Pick<User, "email" | "orgId" | "createdAt">;

function serializeBankLine(line: BankLineRecord): CreateBankLineResponse {
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: line.amount.toString(),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
}

function serializeBankLines(lines: BankLineRecord[]): ListBankLinesResponse["lines"] {
  return lines.map(serializeBankLine);
}

function serializeUsers(users: UserRecord[]): ListUsersResponse["users"] {
  return users.map((user) => ({
    email: user.email,
    orgId: user.orgId,
    createdAt: user.createdAt.toISOString(),
  }));
}

let cachedPrisma: PrismaClient | undefined;

async function resolvePrisma(deps: Partial<Dependencies>) {
  if (deps.prisma) {
    return deps.prisma;
  }

  if (!cachedPrisma) {
    const module = await import("@apgms/shared/src/db");
    cachedPrisma = module.prisma;
  }

  return cachedPrisma;
}

export async function createApp(
  deps: Partial<Dependencies> = {},
  options: FastifyServerOptions = {},
) {
  const prisma = await resolvePrisma(deps);
  const app = Fastify({ logger: true, ...options });

  await app.register(cors, { origin: true });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get(
    "/users",
    withSchema<undefined, undefined, undefined, ListUsersResponse>(
      { response: listUsersResponseSchema },
      async () => {
        const users = await prisma.user.findMany({
          select: { email: true, orgId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });

        return { users: serializeUsers(users) };
      },
    ),
  );

  app.get(
    "/bank-lines",
    withSchema<ListBankLinesQuery, undefined, undefined, ListBankLinesResponse>(
      { query: listBankLinesQuerySchema, response: listBankLinesResponseSchema },
      async ({ parsed }) => {
        const take = parsed.query?.take ?? 20;
        const lines = await prisma.bankLine.findMany({
          orderBy: { date: "desc" },
          take,
        });

        return { lines: serializeBankLines(lines) };
      },
    ),
  );

  app.post(
    "/bank-lines",
    withSchema<undefined, CreateBankLineRequest, undefined, CreateBankLineResponse>(
      { body: createBankLineRequestSchema, response: createBankLineResponseSchema },
      async ({ parsed, rep }) => {
        const created = await prisma.bankLine.create({
          data: {
            orgId: parsed.body.orgId,
            date: parsed.body.date,
            amount: parsed.body.amount,
            payee: parsed.body.payee,
            desc: parsed.body.desc,
          },
        });

        rep.code(201);
        return serializeBankLine(created);
      },
    ),
  );

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
