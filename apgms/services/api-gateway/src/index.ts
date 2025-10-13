import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared";
import { httpRequestDuration, httpRequestErrors, metricsRegistry } from "./metrics";

declare module "fastify" {
  interface FastifyRequest {
    metricsTimerStop?: (statusCode: number) => void;
    metricsTimerCompleted?: boolean;
  }
}

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

app.addHook("onRequest", async (req, reply) => {
  const stopTimer = httpRequestDuration.startTimer({
    route: req.url,
    method: req.method,
  });

  req.metricsTimerCompleted = false;
  req.metricsTimerStop = (statusCode: number) => {
    if (req.metricsTimerCompleted) {
      return;
    }
    stopTimer({ status_code: String(statusCode) });
    req.metricsTimerCompleted = true;
  };

  if (!internalToken || req.url === "/health" || req.url === "/metrics") {
    return;
  }

  const presentedToken = req.headers["x-service-token"];
  if (presentedToken !== internalToken) {
    req.log.warn({ url: req.url }, "blocked request missing service token");
    req.metricsTimerStop?.(401);
    return reply.code(401).send({ error: "unauthorised" });
  }
});

app.addHook("onResponse", async (req, reply) => {
  req.metricsTimerStop?.(reply.statusCode);
});

app.addHook("onError", async (req, reply, error) => {
  httpRequestErrors.inc({
    route: req.url,
    method: req.method,
    status_code: String(reply.statusCode ?? 500),
    error_name: error.name ?? "Error",
  });
  req.metricsTimerStop?.(reply.statusCode ?? 500);
});

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/metrics", async (_req, rep) => {
  rep.header("Content-Type", metricsRegistry.contentType);
  return rep.send(await metricsRegistry.metrics());
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
    req.metricsTimerStop?.(400);
    httpRequestErrors.inc({
      route: req.url,
      method: req.method,
      status_code: "400",
      error_name: e instanceof Error ? e.name : "unknown",
    });
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
