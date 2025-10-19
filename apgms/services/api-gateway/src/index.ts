import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/db";

import otelPlugin from "./plugins/otel";
import metricsPlugin from "./plugins/metrics";
import healthRoutes from "./routes/ops/health";
import readyRoutes from "./routes/ops/ready";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "req.body.password",
        "req.body.*.password",
        "req.body.token",
        "req.body.*.token",
        "req.body.email",
        "req.body.*.email",
        "req.headers.authorization",
        "response.body.password",
        "response.body.*.password",
        "response.body.token",
        "response.body.*.token",
        "response.body.email",
        "response.body.*.email",
      ],
      censor: "[Redacted]",
    },
  },
});

await app.register(cors, { origin: true });
await app.register(otelPlugin);
await app.register(metricsPlugin);
await app.register(healthRoutes);
await app.register(readyRoutes);

app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

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

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
