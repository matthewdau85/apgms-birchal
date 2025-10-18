import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma, createLogger } from "../../../shared/src";

const logger = createLogger({ service: "api-gateway", module: "bootstrap" });

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

logger.info("Environment configuration loaded", {
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
});

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async (req) => {
  const routeLogger = logger.child({ module: "list-users" });
  try {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    routeLogger.debug("Fetched users", { count: users.length });
    return { users };
  } catch (error) {
    routeLogger.error("Failed to fetch users", error as Error);
    req.log.error({ err: error }, "failed to fetch users");
    throw error;
  }
});

// List bank lines (latest first)
app.get("/bank-lines", async (req, rep) => {
  const routeLogger = logger.child({ module: "list-bank-lines" });
  try {
    const take = Number((req.query as any).take ?? 20);
    const safeTake = Math.min(Math.max(take, 1), 200);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: safeTake,
    });
    routeLogger.debug("Fetched bank lines", { count: lines.length, take: safeTake });
    return { lines };
  } catch (error) {
    routeLogger.error("Failed to fetch bank lines", error as Error);
    req.log.error({ err: error }, "failed to fetch bank lines");
    return rep.code(500).send({ error: "internal_error" });
  }
});

// Create a bank line
type BankLinePayload = {
  orgId: string;
  date: string;
  amount: number | string;
  payee: string;
  desc: string;
};

app.post("/bank-lines", async (req, rep) => {
  const routeLogger = logger.child({ module: "create-bank-line" });
  let body: BankLinePayload | undefined;

  try {
    body = req.body as BankLinePayload;
    if (!body?.orgId || !body.date || !body.payee) {
      routeLogger.warn("Invalid bank line payload", { body });
      return rep.code(400).send({ error: "bad_request" });
    }

    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });

    routeLogger.info("Created bank line", { id: created.id, orgId: created.orgId });
    return rep.code(201).send(created);
  } catch (error) {
    routeLogger.error("Failed to create bank line", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
      body,
    });
    req.log.error({ err: error }, "failed to create bank line");
    return rep.code(400).send({ error: "bad_request" });
  }
});

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  logger.debug("Registered routes", { routes: app.printRoutes() });
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.fatal("Failed to start Fastify server", error);
  app.log.error({ err: error }, "failed to start server");
  process.exit(1);
});
