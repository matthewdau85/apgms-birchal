import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import authPlugin from './plugins/auth';
import { orgScopeHook } from './hooks/org-scope';
import { prisma } from "../../../shared/src/db";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(authPlugin);

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

app.register(async function (instance, _opts, done) {
  // Require JWT on all /v1 routes
  instance.addHook('preHandler', instance.authenticate);
  // Enforce org scope
  instance.addHook('preHandler', orgScopeHook);

  // Minimal protected route for verification
  instance.get('/v1/ping', async (req, reply) => {
    // @ts-ignore
    const user = req.user;
    reply.send({ ok: true, user });
  });

  // Example org-scoped route for tests
  instance.get('/v1/orgs/:orgId/resource', async (req, reply) => {
    reply.send({ ok: true });
  });

  done();
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
