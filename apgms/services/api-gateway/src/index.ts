import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import cors from "@fastify/cors";
import dotenv from "dotenv";
import Fastify, { type FastifyInstance } from "fastify";

import { prisma } from "../../../shared/src/db";
import { registerHealthRoutes } from "./routes/health";
import { finishHttpSpan, startHttpSpan } from "./otel.js";
import { setupGracefulShutdown } from "./shutdown.js";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

type PrismaClientLike = typeof prisma;

type CreateAppOptions = {
  prisma: PrismaClientLike;
};

export async function createApp({ prisma: prismaClient }: CreateAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", (request, _reply, done) => {
    (request as any)._otelSpan = startHttpSpan(`${request.method} ${request.url}`, {
      "http.method": request.method,
      "http.target": request.url,
    });
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const durationMs = reply.getResponseTime();
    request.log.info(
      {
        method: request.method,
        url: request.url,
        status: reply.statusCode,
        duration_ms: Number(durationMs),
        req_id: request.id,
      },
      "request completed",
    );
    const spanHandle = (request as any)._otelSpan;
    if (spanHandle) {
      finishHttpSpan(spanHandle, reply.statusCode, {
        "http.method": request.method,
        "http.target": request.url,
        duration_ms: Number(durationMs),
      });
    }
    done();
  });

  await app.register(cors, { origin: true });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  registerHealthRoutes(app, prismaClient);

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prismaClient.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prismaClient.bankLine.findMany({
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
      const created = await prismaClient.bankLine.create({
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

  return app;
}

async function startServer() {
  const app = await createApp({ prisma });
  const removeSignalHandlers = setupGracefulShutdown(app, prisma);
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    removeSignalHandlers();
    await prisma.$disconnect();
    process.exit(1);
  }
}

const isMainModule = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (isMainModule) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
