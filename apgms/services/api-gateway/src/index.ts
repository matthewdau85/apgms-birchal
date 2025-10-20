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

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const apiGatewayKey = process.env.API_GATEWAY_KEY;

const headerValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

app.addHook("preHandler", async (req, reply) => {
  if (req.method !== "GET") {
    const providedKey = headerValue(req.headers["x-api-key"]);
    if (!apiGatewayKey || providedKey !== apiGatewayKey) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  }
});

const requireOrgHeader = (req: { headers: Record<string, any> }) => {
  const orgId = headerValue(req.headers["x-org-id"]);
  return typeof orgId === "string" && orgId.length > 0 ? orgId : null;
};

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (scoped by org, minimal fields)
app.get("/users", async (req, rep) => {
  const orgId = requireOrgHeader(req);
  if (!orgId) {
    return rep.code(400).send({ error: "missing_org" });
  }
  const users = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, email: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (req, rep) => {
  const orgId = requireOrgHeader(req);
  if (!orgId) {
    return rep.code(400).send({ error: "missing_org" });
  }
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    where: { orgId },
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
    select: { id: true, date: true, amount: true, payee: true, desc: true },
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  try {
    const body = req.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };
    const orgId = requireOrgHeader(req);
    if (!orgId) {
      return rep.code(400).send({ error: "missing_org" });
    }
    if (body.orgId !== orgId) {
      return rep.code(403).send({ error: "forbidden" });
    }
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });
    const sanitized = {
      id: created.id,
      orgId: created.orgId,
      date: created.date,
      amount: created.amount,
      payee: created.payee,
      desc: created.desc,
    };
    return rep.code(201).send(sanitized);
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

