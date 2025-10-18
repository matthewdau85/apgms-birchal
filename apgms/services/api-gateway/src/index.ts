import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import {
  createBecsDebitRequestSchema,
  transferDtoSchema,
  transferEventDtoSchema,
} from "@apgms/shared";
import { TransferStore } from "@apgms/shared/payments/transferStore";
import { prisma } from "@apgms/shared/db";
import {
  BecsAdapter,
  HttpBecsClient,
  InMemoryBecsClient,
} from "@apgms/payments";

const app = Fastify({
  logger: true,
});

await app.register(cors, { origin: true });

const transferStore = new TransferStore(prisma);
const becsAdapter = new BecsAdapter({
  client: createBecsClient(app.log),
  store: transferStore,
  logger: app.log.child({ module: "becs-adapter" }),
});

app.addHook("onRequest", async (request, reply) => {
  const correlationId = request.headers["x-request-id"] ?? crypto.randomUUID();
  request.log = request.log.child({ correlationId });
  reply.header("x-request-id", correlationId);
});

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

const remitResponseSchema = z.object({
  transfer: transferDtoSchema,
  events: z.array(transferEventDtoSchema),
});

app.post("/remit/becs", async (request, reply) => {
  const parseResult = createBecsDebitRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    request.log.warn({ issues: parseResult.error.issues }, "invalid remit payload");
    return reply.status(400).send({ error: "validation_error", details: parseResult.error.flatten() });
  }

  const payload = parseResult.data;
  const existing = await transferStore.findByRequestId(payload.requestId);
  const transfer = await becsAdapter.createDebit(payload);
  const events = await transferStore.listEvents(transfer.id);
  const statusCode = existing ? 200 : 202;
  const response = remitResponseSchema.parse({ transfer, events });
  return reply.status(statusCode).send(response);
});

const getRemitParamsSchema = z.object({ id: z.string().cuid() });

app.get("/remit/:id", async (request, reply) => {
  const parsedParams = getRemitParamsSchema.safeParse(request.params);
  if (!parsedParams.success) {
    return reply.status(400).send({ error: "validation_error", details: parsedParams.error.flatten() });
  }

  const transfer = await transferStore.getById(parsedParams.data.id);
  if (!transfer) {
    return reply.status(404).send({ error: "not_found" });
  }
  const events = await transferStore.listEvents(transfer.id);
  return reply.send(remitResponseSchema.parse({ transfer, events }));
});

app.ready(() => {
  app.log.info({ routes: app.printRoutes() }, "routes registered");
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error, "failed to start api-gateway");
  process.exit(1);
});

function createBecsClient(logger: LoggerLike) {
  const baseUrl = process.env.BECS_API_BASE_URL;
  const apiKey = process.env.BECS_API_KEY;
  const timeout = Number(process.env.BECS_API_TIMEOUT_MS ?? 10000);

  if (baseUrl && apiKey) {
    logger.info({ baseUrl }, "using HttpBecsClient");
    return new HttpBecsClient({ baseUrl, apiKey, timeoutMs: timeout });
  }

  logger.warn("BECS API credentials missing, falling back to in-memory client");
  return new InMemoryBecsClient();
}
