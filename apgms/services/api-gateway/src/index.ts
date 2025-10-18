import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import webhookPlugin from "./plugins/webhook";
import webhooksRoutes from "./routes/webhooks";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.addHook("preParsing", async (request, _reply, payload) => {
  if (request.method === "GET" || request.method === "HEAD") {
    return payload;
  }

  if (typeof payload === "string") {
    request.rawBody = payload;
    return Readable.from([payload]);
  }

  if (Buffer.isBuffer(payload)) {
    request.rawBody = payload.toString("utf8");
    return Readable.from([payload]);
  }

  if (payload && typeof (payload as any).on === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of payload as any) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk,
      );
    }
    const rawBuffer = Buffer.concat(chunks);
    request.rawBody = rawBuffer.toString("utf8");
    return Readable.from([rawBuffer]);
  }

  request.rawBody = "";
  return payload;
});

await app.register(webhookPlugin);
await app.register(webhooksRoutes);

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

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
