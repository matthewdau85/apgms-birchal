import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

const buildApp = async () => {
  const app = Fastify({ logger: true });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOriginSet = new Set(allowedOrigins);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOriginSet.has(origin)) {
        cb(null, true);
        return;
      }
      const error = new Error("Origin not allowed");
      cb(error, false);
    },
  });

  app.addHook("onRequest", (req, reply, done) => {
    const headerValue = req.headers["x-request-id"];
    const headerId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const reqId = headerId && headerId.length > 0 ? headerId : randomUUID();
    (req as any).reqId = reqId;
    reply.header("x-request-id", reqId);
    done();
  });

  const auditMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  app.addHook("onSend", async (req, reply, payload) => {
    if (auditMethods.has(req.method)) {
      const reqId = (req as any).reqId;
      app.log.info({
        audit: true,
        method: req.method,
        url: req.url,
        statusCode: reply.statusCode,
        reqId,
        userId: (req as any).user?.id,
        orgId: (req as any).orgId,
      });
    }
    return payload;
  });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

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

  return app;
};

const app = await buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

if (process.env.NODE_ENV !== "test") {
  app
    .listen({ port, host })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}

export { app, buildApp };

