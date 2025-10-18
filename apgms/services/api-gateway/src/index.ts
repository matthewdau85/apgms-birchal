import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import authPlugin from "./plugins/auth";
import orgScopePlugin from "./plugins/org-scope";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(authPlugin);
await app.register(orgScopePlugin);

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get(
  "/users",
  {
    preHandler: [app.verifyBearer],
  },
  async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  }
);

// List bank lines (latest first)
app.get(
  "/bank-lines",
  {
    preHandler: [app.verifyBearer, app.ensureOrgParam()],
  },
  async (req) => {
    const query = req.query as { take?: string | number; orgId?: string };
    const takeParam = Number(query.take ?? 20);
    const limited = Number.isFinite(takeParam) ? takeParam : 20;
    const take = Math.min(Math.max(limited, 1), 200);
    const orgId = query.orgId ?? req.user!.orgId;

    const lines = await prisma.bankLine.findMany({
      where: { orgId },
      orderBy: { date: "desc" },
      take,
    });
    return { lines };
  }
);

// Create a bank line
app.post(
  "/bank-lines",
  {
    preHandler: [app.verifyBearer, app.ensureOrgParam()],
  },
  async (req, rep) => {
    try {
      const body = req.body as {
        orgId: string;
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };
      const orgId = body.orgId ?? req.user!.orgId;
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
