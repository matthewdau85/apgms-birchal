import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "../../../shared/src/db";
import authPlugin from "./plugins/auth";
import { orgScopeHook } from "./hooks/org-scope";
import openapiPlugin from "./plugins/openapi";
import redisPlugin from "./plugins/redis";
import idempotencyPlugin from "./plugins/idempotency";
import corsAllowlistPlugin from "./plugins/cors-allowlist";
import requestIdPlugin from "./plugins/request-id";
import auditPlugin from "./plugins/audit";
import metricsPlugin from "./plugins/metrics";
import healthPlugin from "./plugins/health";
import tracingPlugin from "./plugins/tracing";
import { reportsRoutes } from "./routes/v1/reports";
import { bankLinesRoutes } from "./routes/v1/bank-lines";

const { default: config } = await import("./config");

const app = Fastify({ logger: { level: config.LOG_LEVEL } });

app.log.info({ env: config.NODE_ENV, port: config.PORT }, "config_loaded");

await app.register(helmet);
await app.register(requestIdPlugin);
await app.register(corsAllowlistPlugin);
await app.register(rateLimit, {
  max: config.RATE_LIMIT_MAX,
  timeWindow: config.RATE_LIMIT_WINDOW,
});
await app.register(auditPlugin);
await app.register(redisPlugin);
await app.register(idempotencyPlugin);
await app.register(tracingPlugin);
await app.register(metricsPlugin);
await app.register(healthPlugin);
await app.register(authPlugin);
await app.register(openapiPlugin);

await app.register(reportsRoutes);

app.register(async function (instance, _opts, done) {
  instance.addHook('preHandler', instance.authenticate);
  instance.addHook('preHandler', orgScopeHook);

  instance.get('/v1/ping', async (req, reply) => {
    // @ts-ignore
    const user = req.user;
    reply.send({ ok: true, user });
  });

  await instance.register(bankLinesRoutes);
  done();
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
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
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

const port = config.PORT;
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
