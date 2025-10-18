import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import { logSecurity } from "./lib/seclog";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const headerValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const resolveRoute = (req: FastifyRequest): string => {
  const options = (req as any).routeOptions ?? {};
  return req.routerPath ?? options.url ?? req.url;
};

const nonceCache = new Map<string, number>();
const NONCE_TTL_MS = 5 * 60 * 1000;

const purgeNonceCache = (now: number) => {
  for (const [nonce, seenAt] of nonceCache) {
    if (now - seenAt > NONCE_TTL_MS) {
      nonceCache.delete(nonce);
    }
  }
};

const ensureAuthenticated = async (
  req: FastifyRequest,
  rep: FastifyReply,
  route: string,
  principal?: string,
  orgId?: string,
): Promise<boolean> => {
  const expected = process.env.API_GATEWAY_TOKEN ? `Bearer ${process.env.API_GATEWAY_TOKEN}` : undefined;
  const provided = headerValue(req.headers.authorization);

  if (!expected) {
    return true;
  }

  if (!provided) {
    logSecurity("auth_failure", {
      decision: "deny",
      principal,
      orgId,
      ip: req.ip,
      reason: "missing_authorization_header",
      route,
    });
    await rep.code(401).send({ error: "unauthorized" });
    return false;
  }

  if (provided !== expected) {
    logSecurity("auth_failure", {
      decision: "deny",
      principal,
      orgId,
      ip: req.ip,
      reason: "invalid_authorization_token",
      route,
    });
    await rep.code(401).send({ error: "unauthorized" });
    return false;
  }

  return true;
};

const ensureNotReplay = async (
  req: FastifyRequest,
  rep: FastifyReply,
  route: string,
  principal?: string,
  orgId?: string,
): Promise<boolean> => {
  const nonce = headerValue(req.headers["x-request-nonce"] as string | string[] | undefined);
  if (!nonce) {
    return true;
  }

  const now = Date.now();
  purgeNonceCache(now);

  if (nonceCache.has(nonce)) {
    logSecurity("replay_rejected", {
      decision: "deny",
      principal,
      orgId,
      ip: req.ip,
      reason: "nonce_reuse_detected",
      route,
    });
    await rep.code(409).send({ error: "replay_detected" });
    return false;
  }

  nonceCache.set(nonce, now);
  return true;
};

const ensureRptVerified = async (
  req: FastifyRequest,
  rep: FastifyReply,
  route: string,
  principal?: string,
  orgId?: string,
): Promise<boolean> => {
  const expected = process.env.API_GATEWAY_RPT_TOKEN;
  if (!expected) {
    return true;
  }

  const provided = headerValue(req.headers["x-rpt"] as string | string[] | undefined);
  if (!provided) {
    logSecurity("rpt_verification_failed", {
      decision: "deny",
      principal,
      orgId,
      ip: req.ip,
      reason: "missing_rpt",
      route,
    });
    await rep.code(403).send({ error: "forbidden" });
    return false;
  }

  if (provided !== expected) {
    logSecurity("rpt_verification_failed", {
      decision: "deny",
      principal,
      orgId,
      ip: req.ip,
      reason: "invalid_rpt",
      route,
    });
    await rep.code(403).send({ error: "forbidden" });
    return false;
  }

  return true;
};

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
  const route = resolveRoute(req);
  const principal = headerValue(req.headers["x-user-id"] as string | string[] | undefined);
  const body = req.body as {
    orgId: string;
    date: string;
    amount: number | string;
    payee: string;
    desc: string;
  };
  const orgId = body?.orgId ?? headerValue(req.headers["x-org-id"] as string | string[] | undefined);

  if (!(await ensureAuthenticated(req, rep, route, principal, orgId))) {
    return;
  }

  if (!(await ensureNotReplay(req, rep, route, principal, orgId))) {
    return;
  }

  if (!(await ensureRptVerified(req, rep, route, principal, orgId))) {
    return;
  }

  try {
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
