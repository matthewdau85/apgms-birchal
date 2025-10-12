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
import { logger } from "../../../shared/src/logger";
import { prisma } from "../../../shared/src/db";

const service = "api-gateway";

const app = Fastify({
  logger,
  genReqId: (req) => {
    const headerId = req.headers["x-request-id"];
    if (Array.isArray(headerId)) {
      return headerId[0];
    }
    if (typeof headerId === "string" && headerId.length > 0) {
      return headerId;
    }
    return randomUUID();
  },
});

logger.info({ reqId: `${service}-startup`, service }, "starting api gateway");

await app.register(cors, { origin: true });

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
    const error = e instanceof Error ? e : new Error(String(e));
    req.log.error({ err: error, reqId: req.id }, "failed to create bank line");
    return rep.code(400).send({ error: "bad_request" });
  }
});

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info({ reqId: `${service}-routes` }, app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error({ err, reqId: `${service}-startup` }, "failed to start api gateway");
  process.exit(1);
});
