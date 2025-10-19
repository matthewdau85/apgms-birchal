import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { prisma } from "../../../shared/src/db";
import {
  bankLineCreateBodySchema,
  bankLineCreateResponseSchema,
  bankLineListQuerySchema,
  bankLineListResponseSchema,
  healthResponseSchema,
  listUsersResponseSchema,
} from "../../../shared/src/schemas";
import {
  normalizeValidationError,
  validationErrorResponseSchema,
} from "../../../shared/src/errors";

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, { origin: true });

app.setErrorHandler((error, request, reply) => {
  const validationError = normalizeValidationError(error);
  if (validationError) {
    reply.status(400).send(validationError);
    return;
  }

  request.log.error(error);
  const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;
  reply.status(statusCode).send({ error: "internal_server_error" });
});

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get(
  "/health",
  {
    schema: {
      response: {
        200: healthResponseSchema,
      },
    },
  },
  async () => ({ ok: true, service: "api-gateway" })
);

app.get(
  "/users",
  {
    schema: {
      response: {
        200: listUsersResponseSchema,
      },
    },
  },
  async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      users: users.map((user) => ({
        email: user.email,
        orgId: user.orgId,
        createdAt: user.createdAt.toISOString(),
      })),
    };
  }
);

const toBankLineResponse = (line: {
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

app.get(
  "/bank-lines",
  {
    schema: {
      querystring: bankLineListQuerySchema,
      response: {
        200: bankLineListResponseSchema,
        400: validationErrorResponseSchema,
      },
    },
  },
  async (req) => {
    const take = req.query.take ?? 20;
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });

    return { lines: lines.map(toBankLineResponse) };
  }
);

app.post(
  "/bank-lines",
  {
    schema: {
      body: bankLineCreateBodySchema,
      response: {
        201: bankLineCreateResponseSchema,
        400: validationErrorResponseSchema,
      },
    },
  },
  async (req, rep) => {
    const { orgId, date, amount, payee, desc } = req.body;
    const amountAsString = typeof amount === "number" ? amount.toString() : amount;

    const created = await prisma.bankLine.create({
      data: {
        orgId,
        date: new Date(date),
        amount: amountAsString,
        payee,
        desc,
      },
    });

    return rep.code(201).send({ line: toBankLineResponse(created) });
  }
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
