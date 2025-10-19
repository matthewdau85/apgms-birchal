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
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
});

// sanity log: confirm env is loaded
app.log.info("environment loaded");

const PUBLIC_ROUTES = new Set(["/health", "/ready"]);

app.addHook("preHandler", async (req, rep) => {
  const routeUrl = req.routeOptions?.url;
  if (routeUrl && PUBLIC_ROUTES.has(routeUrl)) {
    return;
  }

  const providedKey = req.headers["x-api-key"];
  const expectedKey = process.env.API_GATEWAY_KEY;
  const expectedHash = process.env.API_GATEWAY_KEY_HASH;

  if (typeof providedKey !== "string") {
    return rep.code(401).send({ error: "unauthorized" });
  }

  if (expectedHash) {
    const ok = await bcrypt.compare(providedKey, expectedHash);
    if (!ok) {
      return rep.code(401).send({ error: "unauthorized" });
    }
    return;
  }

  if (!expectedKey || providedKey !== expectedKey) {
    return rep.code(401).send({ error: "unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/ready", async (_req, rep) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return rep.code(200).send({ ok: true });
  } catch (error) {
    rep.log.error(error, "readiness check failed");
    return rep.code(503).send({ ok: false });
  }
});

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
    const createLineSchema = z.object({
      orgId: z.string().min(1),
      date: z.coerce.date(),
      amount: z.coerce.number(),
      payee: z.string().min(1),
      desc: z.string().min(1),
    });

    const body = createLineSchema.parse(req.body);
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: body.date,
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });
    return rep.code(201).send(created);
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

