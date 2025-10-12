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
import { maskIdentifier } from "../../../shared/src/utils/mask";
import { filterRestrictedLogFields } from "./logging";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded without leaking configuration
app.log.info(filterRestrictedLogFields({
  route: "startup",
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
}), "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async (request) => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  request.log.info(
    filterRestrictedLogFields({
      route: "/users",
      userCount: users.length,
    }),
    "listed users",
  );
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (request) => {
  const take = Number((request.query as any).take ?? 20);
  const safeTake = Math.min(Math.max(take, 1), 200);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: safeTake,
  });
  request.log.info(
    filterRestrictedLogFields({
      route: "/bank-lines",
      take: safeTake,
      resultCount: lines.length,
    }),
    "fetched bank lines",
  );
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (request, reply) => {
  try {
    const { orgId, date, amount, payee, desc } = request.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };
    request.log.info(
      filterRestrictedLogFields({
        route: "/bank-lines",
        orgId: maskIdentifier(orgId),
      }),
      "creating bank line",
    );
    const created = await prisma.bankLine.create({
      data: {
        orgId,
        date: new Date(date),
        amount: amount as any,
        payee,
        desc,
      },
    });
    request.log.info(
      filterRestrictedLogFields({
        route: "/bank-lines",
        orgId: maskIdentifier(orgId),
        bankLineId: maskIdentifier(created.id),
      }),
      "created bank line",
    );
    return reply.code(201).send(created);
  } catch (e) {
    const error = e instanceof Error ? e : new Error("unknown error");
    request.log.error(
      filterRestrictedLogFields({
        route: "/bank-lines",
        message: error.message,
      }),
      "failed to create bank line",
    );
    return reply.code(400).send({ error: "bad_request" });
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

