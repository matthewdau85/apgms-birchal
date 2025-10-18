import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import { z } from "zod";
import { prisma } from "@apgms/shared/src/db";
import securityPlugin from "./plugins/security";
import authPlugin from "./plugins/auth";
import validationPlugin from "./plugins/validation";
import idempotencyPlugin from "./plugins/idempotency";

const app = Fastify({ logger: true });

await app.register(validationPlugin);
await app.register(securityPlugin);
await app.register(authPlugin);
await app.register(idempotencyPlugin);

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const userSchema = z.object({
  email: z.string().email(),
  orgId: z.string(),
  createdAt: z.string().datetime(),
});

const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime(),
  amount: z.string(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime(),
});

const serializeBankLine = (line: {
  id: string;
  orgId: string;
  date: Date;
  amount: { toString(): string };
  payee: string;
  desc: string;
  createdAt: Date;
}) => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date.toISOString(),
  amount: line.amount.toString(),
  payee: line.payee,
  desc: line.desc,
  createdAt: line.createdAt.toISOString(),
});

const ensureDecimal = (value: string | number) => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return false;
    }

    return /^-?\d+(\.\d+)?$/.test(trimmed);
  }

  return false;
};

app.get(
  "/health",
  app.withValidation(
    { response: { 200: z.object({ ok: z.literal(true), service: z.literal("api-gateway") }) } },
    async () => ({ ok: true, service: "api-gateway" as const })
  )
);

app.get(
  "/users",
  app.withValidation(
    {
      response: {
        200: z.object({ users: z.array(userSchema) }),
      },
    },
    async (request) => {
      const users = (await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        where: { orgId: request.orgId },
        orderBy: { createdAt: "desc" },
      })) as Array<{ email: string; orgId: string; createdAt: Date }>;

      return {
        users: users.map((user) => ({
          email: user.email,
          orgId: user.orgId,
          createdAt: user.createdAt.toISOString(),
        })),
      };
    }
  )
);

const listBankLinesQuerySchema = z.object({
  take: z.coerce.number().min(1).max(200).optional(),
});

app.get(
  "/bank-lines",
  app.withValidation(
    {
      querystring: listBankLinesQuerySchema,
      response: {
        200: z.object({ lines: z.array(bankLineSchema) }),
      },
    },
    async (request) => {
      const { take = 20 } = request.query as z.infer<typeof listBankLinesQuerySchema>;
      const lines = await prisma.bankLine.findMany({
        where: { orgId: request.orgId },
        orderBy: { date: "desc" },
        take,
      });

      return { lines: lines.map(serializeBankLine) };
    }
  )
);

const createBankLineBodySchema = z.object({
  date: z.string().datetime(),
  amount: z.union([z.string(), z.number()]).refine(ensureDecimal, "invalid_amount"),
  payee: z.string().min(1).max(256),
  desc: z.string().min(1).max(1024),
});

app.post(
  "/bank-lines",
  app.withValidation(
    {
      body: createBankLineBodySchema,
      response: {
        201: bankLineSchema,
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createBankLineBodySchema>;

      const result = await app.useIdempotency(request, reply, async () => {
        const normalizedAmount =
          typeof body.amount === "number"
            ? body.amount.toString()
            : body.amount.trim();
        const created = await prisma.bankLine.create({
          data: {
            orgId: request.orgId,
            date: new Date(body.date),
            amount: normalizedAmount,
            payee: body.payee,
            desc: body.desc,
          },
        });

        reply.code(201);
        return serializeBankLine(created);
      });

      if (reply.sent) {
        return;
      }

      return result;
    }
  )
);

const applyAllocationsBodySchema = z.object({
  allocations: z
    .array(
      z.object({
        bankLineId: z.string().min(1),
        amount: z.coerce.number().positive(),
        memo: z.string().max(256).optional(),
      })
    )
    .min(1),
});

const applyAllocationsResponseSchema = z.object({
  applied: z.number().int().min(0),
  processedAt: z.string().datetime(),
  allocations: z.array(
    z.object({
      bankLineId: z.string(),
      amount: z.number().positive(),
      memo: z.string().max(256).optional(),
    })
  ),
});

const errorResponseSchema = z.object({ error: z.string() });

app.post(
  "/allocations/apply",
  app.withValidation(
    {
      body: applyAllocationsBodySchema,
      response: {
        200: applyAllocationsResponseSchema,
        400: errorResponseSchema,
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof applyAllocationsBodySchema>;
      const bankLineIds = body.allocations.map((item) => item.bankLineId);

      const bankLines = await prisma.bankLine.findMany({
        where: { id: { in: bankLineIds }, orgId: request.orgId },
        select: { id: true },
      });

      if (bankLines.length !== bankLineIds.length) {
        reply.code(400);
        return { error: "unknown_bank_line" } as const;
      }

      const result = await app.useIdempotency(request, reply, async () => {
        const processedAt = new Date().toISOString();
        return {
          applied: body.allocations.length,
          processedAt,
          allocations: body.allocations.map((item) => ({
            bankLineId: item.bankLineId,
            amount: item.amount,
            memo: item.memo,
          })),
        };
      });

      if (reply.sent) {
        return;
      }

      return result;
    }
  )
);

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
