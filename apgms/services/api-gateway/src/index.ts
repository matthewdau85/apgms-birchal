import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import requestId from "@fastify/request-id";
import { audit, buildCorsOriginValidator, prisma } from "@apgms/shared";

type MutationHandler<T = unknown> = (
  req: FastifyRequest,
  rep: FastifyReply,
) => Promise<T>;

const extractHeader = (req: FastifyRequest, header: string): string | undefined => {
  const value = req.headers[header];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
};

const withAudit = <T>(handler: MutationHandler<T>) => {
  return async (req: FastifyRequest, rep: FastifyReply) => {
    const started = Date.now();
    try {
      return await handler(req, rep);
    } finally {
      const status = rep.statusCode ?? (rep.raw.statusCode as number | undefined) ?? 500;
      const pathLabel = req.routeOptions?.url ?? req.url;
      const entry = audit(
        req.method,
        pathLabel,
        extractHeader(req, "x-user-id"),
        extractHeader(req, "x-org-id"),
        status,
      );
      req.log.info({ audit: entry, durationMs: Date.now() - started }, "http mutation");
    }
  };
};

const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 100);
const rateLimitWindow = process.env.RATE_LIMIT_WINDOW ?? "1 minute";
const corsOrigin = buildCorsOriginValidator(process.env.ALLOWED_ORIGINS);

const app = Fastify({ logger: true });

await app.register(requestId);
await app.register(helmet);
await app.register(rateLimit, { max: rateLimitMax, timeWindow: rateLimitWindow });
await app.register(cors, { origin: corsOrigin as any });

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
app.post(
  "/bank-lines",
  withAudit(async (req, rep) => {
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
  }),
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
