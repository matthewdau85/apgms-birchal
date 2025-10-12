// --- load ../../../../.env (repo root) from src ---
// src = apgms/services/api-gateway/src
// repo root .env = apgms/.env  ==> go up three levels
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "@fastify/type-provider-zod";
import { z, ZodError } from "zod";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(422).send({
      statusCode: 422,
      error: "Unprocessable Entity",
      message: "Request validation failed",
      issues: error.issues,
    });
  }

  if ((error as any).validation) {
    return reply.status(422).send({
      statusCode: 422,
      error: "Unprocessable Entity",
      message: error.message,
      issues: (error as any).validation,
    });
  }

  request.log.error(error);
  return reply.status(error.statusCode ?? 500).send({
    statusCode: error.statusCode ?? 500,
    error: error.name ?? "InternalServerError",
    message: error.message,
  });
});

await app.register(cors, { origin: true });

// Quick sanity log so you can verify the DSN being used
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
const UsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

app.get(
  "/users",
  {
    schema: {
      querystring: UsersQuerySchema,
    },
  },
  async (req) => {
    const { page, pageSize } = req.query;
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { users };
  }
);

// List bank lines (latest first)
const BankLineListQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(20),
  orgId: z.string().min(1).optional(),
});

app.get(
  "/bank-lines",
  {
    schema: {
      querystring: BankLineListQuerySchema,
    },
  },
  async (req) => {
    const { take, orgId } = req.query;
    const lines = await prisma.bankLine.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { date: "desc" },
      take,
    });
    return { lines };
  }
);

// Create a bank line
const BankLineCreateSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "date must be YYYY-MM-DD"),
  amount: z.coerce.number().finite(),
  payee: z.string().min(1).max(256),
  desc: z.string().min(1).max(512),
});

app.post(
  "/bank-lines",
  {
    schema: {
      body: BankLineCreateSchema,
    },
  },
  async (req, rep) => {
    const { orgId, date, amount, payee, desc } = req.body;
    const created = await prisma.bankLine.create({
      data: {
        orgId,
        date: new Date(date),
        amount,
        payee,
        desc,
      },
    });
    return rep.code(201).send(created);
  }
);

// Print all routes once ready (to verify POST exists)
app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
