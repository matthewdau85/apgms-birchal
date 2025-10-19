import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { rememberNonce } from "../lib/idempotency";

const WEBHOOK_TTL_SECONDS = 60 * 5;

const webhookPayloadSchema = z
  .object({
    timestamp: z.coerce.number(),
    nonce: z.string().min(8),
    hmac: z.string().min(32),
  })
  .passthrough();

const webhookResponseSchema = z.object({ received: z.boolean() });

function computeSignature(secret: string, body: Record<string, unknown>) {
  const sortedEntries = Object.entries(body)
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b));
  const payload = JSON.stringify(Object.fromEntries(sortedEntries));
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function registerWebhookRoutes(app: FastifyInstance) {
  app.route({
    method: "POST",
    url: "/webhooks/payto",
    config: {
      replySchema: webhookResponseSchema,
    },
    async handler(request, reply) {
      const parsed = webhookPayloadSchema.parse(request.body ?? {});

      const secret = process.env.HMAC_SECRET;
      if (!secret) {
        request.log.error("HMAC_SECRET must be configured");
        return reply.code(500).send({ error: "server_error" });
      }

      const now = Date.now();
      if (Math.abs(now - parsed.timestamp * 1000) > WEBHOOK_TTL_SECONDS * 1000) {
        return reply.code(409).send({ error: "stale_signature" });
      }

      const expected = computeSignature(secret, parsed);
      const expectedBuf = Buffer.from(expected, "hex");
      const providedBuf = Buffer.from(parsed.hmac, "hex");
      if (
        expectedBuf.length !== providedBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, providedBuf)
      ) {
        return reply.code(401).send({ error: "invalid_signature" });
      }

      const nonceAccepted = await rememberNonce(parsed.nonce, WEBHOOK_TTL_SECONDS);
      if (!nonceAccepted) {
        return reply.code(409).send({ error: "nonce_replayed" });
      }

      request.log.info({ event: parsed }, "webhook received");

      return reply.code(202).send({ received: true });
    },
  });
}
