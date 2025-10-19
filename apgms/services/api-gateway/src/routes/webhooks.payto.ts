import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  consentWebhookSchema,
  mandateWebhookSchema,
  paymentWebhookSchema,
} from "../schemas/payto";
import { prisma } from "../../../shared/src/db";

const SIGNATURE_HEADER = "x-signature";
const NONCE_HEADER = "x-nonce";
const TIMESTAMP_HEADER = "x-timestamp";
const ALLOWED_DRIFT_MS = 5 * 60 * 1000;
const WEBHOOK_SECRET = process.env.PAYTO_WEBHOOK_SECRET ?? "sandbox-secret";

async function verifyEnvelope(req: FastifyRequest, reply: FastifyReply, bodyString: string) {
  const signature = req.headers[SIGNATURE_HEADER];
  const nonce = req.headers[NONCE_HEADER];
  const timestamp = req.headers[TIMESTAMP_HEADER];

  if (!signature || !nonce || !timestamp) {
    reply.code(401);
    reply.send({ error: "unauthorized" });
    return;
  }
  if (Array.isArray(signature) || Array.isArray(nonce) || Array.isArray(timestamp)) {
    reply.code(400);
    reply.send({ error: "invalid_headers" });
    return;
  }

  const receivedAt = new Date(timestamp);
  if (Number.isNaN(receivedAt.getTime())) {
    reply.code(400);
    reply.send({ error: "invalid_timestamp" });
    return;
  }

  const drift = Math.abs(Date.now() - receivedAt.getTime());
  if (drift > ALLOWED_DRIFT_MS) {
    reply.code(401);
    reply.send({ error: "stale_event" });
    return;
  }

  const nonceKey = `payto:nonce:${nonce}`;
  const stored = await req.server.redis.setnx(nonceKey, "1", 5 * 60);
  if (!stored) {
    reply.code(409);
    reply.send({ error: "replayed" });
    return;
  }

  const computed = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${nonce}.${bodyString}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== computed.length || !timingSafeEqual(received, computed)) {
    reply.code(401);
    reply.send({ error: "signature_mismatch" });
    return;
  }

  return { nonce, timestamp };
}

async function writeAudit(options: {
  orgId: string;
  subjectType: string;
  subjectId: string;
  kind: string;
  payload: Record<string, unknown>;
}) {
  await prisma.auditBlob.create({
    data: {
      orgId: options.orgId,
      subjectType: options.subjectType,
      subjectId: options.subjectId,
      kind: options.kind,
      payload: options.payload,
    },
  });
}

export const payToWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/consent", async (req, reply) => {
    const body = consentWebhookSchema.safeParse(req.body);
    if (!body.success) {
      reply.code(400);
      return reply.send({ error: "invalid_payload", details: body.error.flatten() });
    }
    const bodyString = JSON.stringify(body.data);
    const verified = await verifyEnvelope(req, reply, bodyString);
    if (!verified) return;

    const connection = await prisma.bankConnection.findUnique({ where: { id: body.data.bankConnectionId } });
    if (!connection) {
      reply.code(404);
      return reply.send({ error: "bank_connection_not_found" });
    }

    await prisma.bankConnection.update({
      where: { id: connection.id },
      data: { status: body.data.status },
    });

    await writeAudit({
      orgId: connection.orgId,
      subjectType: "bank_connection",
      subjectId: connection.id,
      kind: body.data.type,
      payload: body.data,
    });

    return reply.send({ ok: true });
  });

  app.post("/mandate", async (req, reply) => {
    const body = mandateWebhookSchema.safeParse(req.body);
    if (!body.success) {
      reply.code(400);
      return reply.send({ error: "invalid_payload", details: body.error.flatten() });
    }
    const bodyString = JSON.stringify(body.data);
    const verified = await verifyEnvelope(req, reply, bodyString);
    if (!verified) return;

    const mandate = await prisma.payToMandate.findUnique({ where: { id: body.data.mandateId } });
    if (!mandate) {
      reply.code(404);
      return reply.send({ error: "mandate_not_found" });
    }
    if (mandate.orgId !== body.data.orgId) {
      reply.code(403);
      return reply.send({ error: "forbidden" });
    }

    await prisma.payToMandate.update({
      where: { id: mandate.id },
      data: { status: body.data.status },
    });

    await writeAudit({
      orgId: mandate.orgId,
      subjectType: "mandate",
      subjectId: mandate.id,
      kind: body.data.type,
      payload: body.data,
    });

    return reply.send({ ok: true });
  });

  app.post("/payment", async (req, reply) => {
    const body = paymentWebhookSchema.safeParse(req.body);
    if (!body.success) {
      reply.code(400);
      return reply.send({ error: "invalid_payload", details: body.error.flatten() });
    }
    const bodyString = JSON.stringify(body.data);
    const verified = await verifyEnvelope(req, reply, bodyString);
    if (!verified) return;

    const mandate = await prisma.payToMandate.findUnique({ where: { id: body.data.mandateId } });
    if (!mandate) {
      reply.code(404);
      return reply.send({ error: "mandate_not_found" });
    }

    await writeAudit({
      orgId: mandate.orgId,
      subjectType: "mandate_payment",
      subjectId: body.data.paymentId,
      kind: body.data.type,
      payload: body.data,
    });

    return reply.send({ ok: true });
  });
};
