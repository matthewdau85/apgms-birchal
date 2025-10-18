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
import { createBankLinesRoutes, type BankLineRouteDeps } from "./routes/bank-lines";
import {
  bankLinesCollectionJsonSchema,
  createBankLineBodyJsonSchema,
  createBankLineResponseJsonSchema,
  getBankLinesQueryJsonSchema,
} from "./schemas/bank-lines";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin:
    process.env.NODE_ENV === "production"
      ? false
      : [/^http:\/\/localhost(?::\d+)?$/, /^http:\/\/127\.0\.0\.1(?::\d+)?$/],
  credentials: true,
});


// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

await app.register(createBankLinesRoutes({ prisma } satisfies BankLineRouteDeps));

app.get("/openapi.json", async () => ({
  openapi: "3.1.0",
  info: {
    title: "APGMS API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      BankLine: bankLinesCollectionJsonSchema.properties.bankLines.items,
      BankLineCollection: bankLinesCollectionJsonSchema,
      BankLineCreateBody: createBankLineBodyJsonSchema,
      BankLineResponse: createBankLineResponseJsonSchema,
      BankLineQuery: getBankLinesQueryJsonSchema,
    },
  },
  paths: {
    "/bank-lines": {
      get: {
        summary: "List bank lines",
        parameters: [
          {
            name: "orgId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "cursor",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 200 },
          },
        ],
        responses: {
          200: {
            description: "Bank lines list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BankLineCollection" },
              },
            },
          },
        },
      },
      post: {
        summary: "Create bank line",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BankLineCreateBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Replayed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BankLineResponse" },
              },
            },
          },
          201: {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BankLineResponse" },
              },
            },
          },
        },
      },
    },
  },
}));


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

