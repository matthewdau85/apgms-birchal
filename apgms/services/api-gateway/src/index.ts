import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma, withOrgContext } from "../../../shared/src/db";

declare module "fastify" {
  interface FastifyRequest {
    orgId?: string;
  }
}

const app = Fastify({ logger: true });

const decodeBase64Url = (input: string): string => {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = input.length % 4;
  if (pad) {
    input = input + "=".repeat(4 - pad);
  }
  return Buffer.from(input, "base64").toString("utf8");
};

const extractOrgId = (authorization?: string): string | undefined => {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length);
  const segments = token.split(".");
  if (segments.length < 2) {
    return undefined;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(segments[1] ?? ""));
    return payload.orgId ?? payload.org_id ?? payload.orgID;
  } catch (err) {
    app.log.warn({ err }, "failed to decode jwt payload");
    return undefined;
  }
};

app.addHook("onRequest", async (req) => {
  req.orgId = extractOrgId(req.headers.authorization);
});

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async (req, rep) => {
  if (!req.orgId) {
    return rep.code(401).send({ error: "missing_org" });
  }

  return withOrgContext(req.orgId, async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });
});

// List bank lines (latest first)
app.get("/bank-lines", async (req, rep) => {
  if (!req.orgId) {
    return rep.code(401).send({ error: "missing_org" });
  }

  return withOrgContext(req.orgId, async () => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  const body = req.body as {
    orgId?: string;
    date: string;
    amount: number | string;
    payee: string;
    desc: string;
  };

  const orgId = req.orgId ?? body.orgId;

  if (!orgId) {
    return rep.code(401).send({ error: "missing_org" });
  }

  if (req.orgId && body.orgId && req.orgId !== body.orgId) {
    return rep.code(403).send({ error: "org_mismatch" });
  }

  try {
    return await withOrgContext(orgId, async () => {
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
    });
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

