import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import {
  buildValidationError,
  createBankLineBodySchema,
  createBankLineResponseSchema,
  getBankLinesQuerySchema,
  getBankLinesResponseSchema,
  toSerializableBankLine,
} from "./validation";

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
app.get("/bank-lines", async (req, rep) => {
  const parsedQuery = getBankLinesQuerySchema.safeParse(req.query ?? {});
  if (!parsedQuery.success) {
    return rep.code(400).send(buildValidationError(parsedQuery.error));
  }

  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: parsedQuery.data.take,
  });

  const response = getBankLinesResponseSchema.parse({
    lines: lines.map(toSerializableBankLine),
  });

  return response;
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  const parsedBody = createBankLineBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return rep.code(400).send(buildValidationError(parsedBody.error));
  }

  const created = await prisma.bankLine.create({
    data: parsedBody.data,
  });

  const response = createBankLineResponseSchema.parse(
    toSerializableBankLine(created),
  );

  return rep.code(201).send(response);
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

