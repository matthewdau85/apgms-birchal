import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

declare module "fastify" {
  interface FastifyRequest {
    reqId?: string;
  }
}

const app = Fastify({ logger: true });

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 300);
const rateLimitWindowMs = 60_000;
const rateLimitStore = new Map<string, { count: number; expiresAt: number }>();

// Attach request identifier and enforce rate limiting
app.addHook("onRequest", async (req, reply) => {
  const headerValue = req.headers["x-request-id"];
  req.reqId =
    typeof headerValue === "string" && headerValue.trim().length > 0
      ? headerValue
      : randomUUID();

  const identifier = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  const maxRequests = Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 300;

  if (!entry || now >= entry.expiresAt) {
    rateLimitStore.set(identifier, { count: 1, expiresAt: now + rateLimitWindowMs });
    return;
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.expiresAt - now) / 1000);
    reply.header("Retry-After", Math.max(retryAfterSeconds, 0));
    reply.code(429).send({ error: "rate_limit_exceeded" });
    return reply;
  }

  entry.count += 1;
});

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },
});

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

// Security headers and simple audit on mutations
app.addHook("onSend", async (req, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  reply.header("Cross-Origin-Resource-Policy", "same-origin");
  reply.header("Cross-Origin-Opener-Policy", "same-origin");
  reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    req.log.info(
      {
        audit: true,
        method: req.method,
        url: req.url,
        statusCode: reply.statusCode,
        reqId: req.reqId,
      },
      "mutation",
    );
  }

  return payload as any;
});

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

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
