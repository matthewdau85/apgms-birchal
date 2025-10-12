import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";

type ErrorResponse = { error: string; message?: string };

type BankLine = Awaited<ReturnType<(typeof prisma.bankLine)["create"]>>;

const sendError = (
  reply: FastifyReply,
  status: number,
  error: ErrorResponse["error"],
  message?: string,
) => reply.code(status).send(message ? { error, message } : { error });

const replyBadRequest = (reply: FastifyReply, message?: string) =>
  sendError(reply, 400, "bad_request", message);

const replyConflict = (reply: FastifyReply, message?: string) =>
  sendError(reply, 409, "conflict", message);

const replyNotFound = (reply: FastifyReply, message?: string) =>
  sendError(reply, 404, "not_found", message);

const getBankLinesQuerySchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  take: z
    .coerce
    .number()
    .int()
    .min(1, "take must be at least 1")
    .max(200, "take must be <= 200")
    .optional(),
  externalId: z.string().min(1, "externalId must not be empty").optional(),
});

const createBankLineSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  externalId: z.string().min(1, "externalId is required"),
  date: z.coerce
    .date()
    .refine((value) => !Number.isNaN(value.getTime()), {
      message: "date must be a valid date",
    }),
  amount: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "amount must be a number",
    }),
  payee: z.string().min(1, "payee is required"),
  desc: z.string().min(1, "desc is required"),
});

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get<{
  Querystring: z.infer<typeof getBankLinesQuerySchema>;
  Reply: { lines: BankLine[] } | { line: BankLine } | ErrorResponse;
}>("/bank-lines", async (req, rep) => {
  const parseResult = getBankLinesQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    const [issue] = parseResult.error.issues;
    return replyBadRequest(rep, issue?.message);
  }

  const { orgId, take, externalId } = parseResult.data;

  if (externalId) {
    const line = await prisma.bankLine.findFirst({
      where: { orgId, externalId },
    });
    if (!line) {
      return replyNotFound(rep, "Bank line not found");
    }
    return { line };
  }

  const limit = take ?? 20;
  const lines = await prisma.bankLine.findMany({
    where: { orgId },
    orderBy: { date: "desc" },
    take: limit,
  });
  return { lines };
});

// Create a bank line
app.post<{
  Body: z.infer<typeof createBankLineSchema>;
  Reply: { line: BankLine } | ErrorResponse;
}>("/bank-lines", async (req, rep) => {
  const parseResult = createBankLineSchema.safeParse(req.body);
  if (!parseResult.success) {
    const [issue] = parseResult.error.issues;
    return replyBadRequest(rep, issue?.message);
  }

  const { orgId, externalId, date, amount, payee, desc } = parseResult.data;

  try {
    const created = await prisma.bankLine.create({
      data: {
        orgId,
        externalId,
        date,
        amount,
        payee,
        desc,
      },
    });
    return rep.code(201).send({ line: created });
  } catch (error) {
    req.log.error(error);
    const prismaError = error as {
      code?: string;
      meta?: { target?: unknown };
    };
    if (
      prismaError?.code === "P2002" &&
      Array.isArray(prismaError.meta?.target) &&
      prismaError.meta?.target.includes("orgId") &&
      prismaError.meta?.target.includes("externalId")
    ) {
      return replyConflict(rep, "Bank line already exists");
    }
    return replyBadRequest(rep);
  }
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

