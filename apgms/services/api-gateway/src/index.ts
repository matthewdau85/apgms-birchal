import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Prisma } from "@prisma/client";
import type { BankLine as PrismaBankLine } from "@prisma/client";
import { prisma } from "../../../shared/src/db";
import replyValidationPlugin, { withValidatedReply } from "./plugins/reply-validate";
import {
  BankLine as BankLineSchema,
  CreateRequest,
  type BankLineResponse,
  type ListResponsePayload,
  ListResponse,
} from "./schemas/bank-lines";
import { ZodError } from "zod";

const toBankLineResponse = (line: PrismaBankLine): BankLineResponse => {
  const amountDecimal = new Prisma.Decimal(line.amount);
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amountCents: Number(amountDecimal.mul(100).toString()),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
};

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await replyValidationPlugin(app);

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
app.get(
  "/bank-lines",
  withValidatedReply(ListResponse, async (req): Promise<ListResponsePayload> => {
    const take = Number((req.query as Record<string, unknown> | undefined)?.take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return {
      lines: lines.map(toBankLineResponse),
    };
  }),
);

// Create a bank line
app.post(
  "/bank-lines",
  withValidatedReply(BankLineSchema, async (req, rep): Promise<BankLineResponse | { error: string }> => {
    try {
      const body = CreateRequest.parse(req.body);
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: new Prisma.Decimal(body.amountCents).div(100),
          payee: body.payee,
          desc: body.desc,
        },
      });
      rep.code(201);
      return toBankLineResponse(created);
    } catch (error) {
      if (error instanceof ZodError) {
        rep.code(400);
        return { error: "bad_request" };
      }

      req.log.error(error);
      rep.code(500);
      return { error: "internal_server_error" };
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
