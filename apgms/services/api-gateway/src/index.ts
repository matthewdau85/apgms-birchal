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

import authPlugin from "./plugins/auth";
import orgScopePlugin from "./plugins/org-scope";
import rbacPlugin from "./plugins/rbac";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(authPlugin);
await app.register(orgScopePlugin);
await app.register(rbacPlugin);

const publicPaths = new Set(["/healthz", "/readyz"]);

app.addHook("onRequest", async (req, reply) => {
  const path = req.url.split("?")[0];
  if (publicPaths.has(path)) {
    return;
  }
  await app.verifyAuthorization(req, reply);
});

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));
app.get("/readyz", async () => ({ ready: true }));

// List users (email + org)
app.get(
  "/users",
  { preHandler: app.requireRole("admin") },
  async (req) => {
    const where = req.prismaOrgFilter();
    const users = await prisma.user.findMany({
      where,
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  },
);

// List bank lines (latest first)
app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const where = req.prismaOrgFilter();
  const lines = await prisma.bankLine.findMany({
    where,
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
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
    const targetOrgId = body.orgId ?? req.orgId ?? "";
    req.guardOrgParam(targetOrgId);

    const created = await prisma.bankLine.create({
      data: {
        orgId: targetOrgId,
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

