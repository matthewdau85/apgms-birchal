import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(helmet);

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      return cb(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }

    return cb(null, false);
  },
});

// sanity log: confirm env is loaded
app.log.info("environment configuration loaded");

const apiGatewayKey = process.env.API_GATEWAY_KEY;

app.addHook("onRequest", async (req, rep) => {
  if (req.method === "GET") {
    return;
  }

  const headerKey = req.headers["x-api-key"];

  if (typeof headerKey !== "string" || !apiGatewayKey || headerKey !== apiGatewayKey) {
    req.log.warn({ method: req.method, url: req.url }, "unauthorized request blocked");
    return rep.code(401).send({ error: "unauthorized" });
  }
});

const createBankLineRequestSchema = z.object({
  orgId: z.string().min(1),
  date: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date"),
  amount: z.union([
    z.number(),
    z
      .string()
      .min(1)
      .refine((value) => !Number.isNaN(Number(value)), "Invalid amount"),
  ]),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

const bankLineResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.string(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string(),
});

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
app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  try {
    const body = createBankLineRequestSchema.parse(req.body ?? {});

    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });

    const responsePayload = bankLineResponseSchema.parse({
      ...created,
      date: created.date.toISOString(),
      createdAt: created.createdAt.toISOString(),
      amount: created.amount.toString(),
    });

    return rep.code(201).send(responsePayload);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
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

