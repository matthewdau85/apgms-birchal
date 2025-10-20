import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY;
const ORG_HEADER = "x-org-id";

app.addHook("onRequest", async (req, rep) => {
  if (req.method === "GET") {
    return;
  }

  if (!API_GATEWAY_KEY) {
    req.log.error("API gateway key missing; rejecting non-GET request");
    return rep.code(500).send({ error: "server_misconfigured" });
  }

  const providedKey = req.headers["x-api-key"];
  if (providedKey !== API_GATEWAY_KEY) {
    return rep.code(401).send({ error: "unauthorized" });
  }
});

const requireOrgContext = (
  req: FastifyRequest,
  rep: FastifyReply,
): string | undefined => {
  const header = req.headers[ORG_HEADER];
  if (typeof header !== "string" || header.trim().length === 0) {
    rep.code(400).send({ error: "org_header_required" });
    return;
  }
  return header;
};

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async (req, rep) => {
  const orgId = requireOrgContext(req, rep);
  if (!orgId) {
    return;
  }

  const users = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (req, rep) => {
  const orgId = requireOrgContext(req, rep);
  if (!orgId) {
    return;
  }

  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    where: { orgId },
    select: {
      id: true,
      date: true,
      amount: true,
      payee: true,
      desc: true,
      createdAt: true,
    },
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  const orgId = requireOrgContext(req, rep);
  if (!orgId) {
    return;
  }

  try {
    const body = req.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };

    if (!body || typeof body.orgId !== "string" || body.orgId.trim().length === 0) {
      return rep.code(400).send({ error: "invalid_org" });
    }

    if (body.orgId !== orgId) {
      return rep.code(403).send({ error: "forbidden_org" });
    }

    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
      select: {
        id: true,
        date: true,
        amount: true,
        payee: true,
        desc: true,
        createdAt: true,
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

