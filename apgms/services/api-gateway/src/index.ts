import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

const DEMO_ORG_COOKIE_NAME = "demo_org";
const API_KEY = process.env.API_KEY;

const normalizeHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const parseCookies = (cookieHeader: string | string[] | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader;
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) {
      return acc;
    }
    const name = rawName.trim();
    const value = rawValue.join("=").trim();
    if (!name) {
      return acc;
    }
    acc[name] = value;
    return acc;
  }, {});
};

const resolveOrgId = (req: FastifyRequest, body?: { orgId?: string | null }): string | undefined => {
  const headerOrg = normalizeHeaderValue(req.headers["x-org-id"]);
  if (headerOrg?.trim()) {
    return headerOrg.trim();
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieOrg = cookies[DEMO_ORG_COOKIE_NAME];
  if (cookieOrg?.trim()) {
    return cookieOrg.trim();
  }

  const bodyOrg = body?.orgId;
  if (bodyOrg && typeof bodyOrg === "string" && bodyOrg.trim()) {
    return bodyOrg.trim();
  }

  return undefined;
};

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.addHook("onRequest", async (req, reply) => {
  if (req.method === "GET") {
    return;
  }

  if (!API_KEY) {
    req.log.error("API_KEY env var is not set");
    return reply.code(500).send({ error: "server_configuration" });
  }

  const providedKey = normalizeHeaderValue(req.headers["x-api-key"]);
  if (providedKey !== API_KEY) {
    return reply.code(401).send({ error: "unauthorized" });
  }
});

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/dev/login", async (_req, reply) => {
  reply.header(
    "Set-Cookie",
    `${DEMO_ORG_COOKIE_NAME}=demo-org; Path=/; HttpOnly; SameSite=Lax`
  );
  return reply.send({ ok: true, orgId: "demo-org" });
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
    const body = req.body as {
      orgId?: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };
    const orgId = resolveOrgId(req, body);
    if (!orgId) {
      return rep.code(400).send({ error: "missing_org" });
    }
    const created = await prisma.bankLine.create({
      data: {
        orgId,
        date: new Date(body.date),
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

