import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

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

const bankLineUpdatableFields = [
  "date",
  "amount",
  "payee",
  "desc",
  "currency",
  "source",
  "externalId",
  "cleared",
  "notes",
] as const;

// Update a bank line
app.patch("/bank-lines/:id", async (req, rep) => {
  try {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown> & { orgId?: string };

    const existing = await prisma.bankLine.findUnique({ where: { id } });
    if (!existing) {
      return rep.code(404).send({ error: "not_found" });
    }

    if (!body.orgId) {
      return rep.code(400).send({ error: "org_required" });
    }

    if (body.orgId !== existing.orgId) {
      return rep.code(404).send({ error: "not_found" });
    }

    const data: Record<string, unknown> = {};
    for (const field of bankLineUpdatableFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = body[field];
        if (value === undefined) {
          continue;
        }
        if (field === "date") {
          const parsed = new Date(value as string);
          if (Number.isNaN(parsed.getTime())) {
            return rep.code(400).send({ error: "invalid_date" });
          }
          data.date = parsed;
          continue;
        }
        if (field === "amount") {
          data.amount = value as any;
          continue;
        }
        data[field] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return rep.code(400).send({ error: "no_updates" });
    }

    const updated = await prisma.bankLine.update({
      where: { id },
      data: data as any,
    });

    return updated;
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

// Delete a bank line
app.delete("/bank-lines/:id", async (req, rep) => {
  try {
    const { id } = req.params as { id: string };
    const query = (req.query ?? {}) as { orgId?: string };
    const body = (req.body ?? {}) as { orgId?: string };

    const existing = await prisma.bankLine.findUnique({ where: { id } });
    if (!existing) {
      return rep.code(404).send({ error: "not_found" });
    }

    const orgId = body.orgId ?? query.orgId;

    if (!orgId) {
      return rep.code(400).send({ error: "org_required" });
    }

    if (orgId !== existing.orgId) {
      return rep.code(404).send({ error: "not_found" });
    }

    await prisma.bankLine.delete({ where: { id } });

    return { ok: true };
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

