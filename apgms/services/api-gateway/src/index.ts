import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/src/db";
import Redis from "./vendor/ioredis.js";

import redisPlugin from "./plugins/redis";
import bankLinesRoutes from "./routes/v1/bank-lines";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const redisClient = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
await app.register(redisPlugin, { client: redisClient });

app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

await app.register(bankLinesRoutes, { prefix: "/v1", redis: redisClient });

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
