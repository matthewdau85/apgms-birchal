import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";

const FIVE_MINUTES_SECONDS = 5 * 60;
const NONCE_KEY_PREFIX = "webhook:payto:nonce:";

interface PaytoWebhookBody {
  [key: string]: unknown;
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string | Buffer;
  }
}

function getRequiredHeader(headers: FastifyRequest["headers"], name: string) {
  const value = headers[name.toLowerCase() as keyof typeof headers];
  if (!value || Array.isArray(value)) {
    return null;
  }
  return value as string;
}

function resolveRawBodyString(request: FastifyRequest): string {
  const raw = (request as FastifyRequest & { rawBody?: string | Buffer }).rawBody;
  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }
  if (typeof raw === "string") {
    return raw;
  }
  const { body } = request as { body?: unknown };
  if (body === undefined || body === null) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  return JSON.stringify(body);
}

const webhooksRoutes = async (fastify: FastifyInstance) => {
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  if (!secret) {
    throw new Error("WEBHOOK_HMAC_SECRET must be configured");
  }

  fastify.post<{
    Body: PaytoWebhookBody;
  }>("/webhooks/payto", {
    schema: {
      response: {
        202: {
          type: "object",
          properties: {
            received: { type: "boolean" },
          },
          required: ["received"],
        },
      },
    },
    handler: async (request, reply) => {
      const idempotencyKey = getRequiredHeader(request.headers, "x-idempotency-key");
      const timestampHeader = getRequiredHeader(request.headers, "x-timestamp");
      const nonce = getRequiredHeader(request.headers, "x-nonce");
      const signature = getRequiredHeader(request.headers, "x-signature");

      if (!idempotencyKey) {
        return reply.code(400).send({ error: "missing_idempotency_key" });
      }
      if (!timestampHeader) {
        return reply.code(400).send({ error: "missing_timestamp" });
      }
      if (!nonce) {
        return reply.code(400).send({ error: "missing_nonce" });
      }
      if (!signature) {
        return reply.code(401).send({ error: "missing_signature" });
      }

      const timestamp = Number(timestampHeader);
      if (!Number.isFinite(timestamp)) {
        return reply.code(400).send({ error: "invalid_timestamp" });
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSeconds - timestamp) > FIVE_MINUTES_SECONDS) {
        return reply.code(400).send({ error: "stale_timestamp" });
      }

      const rawBody = resolveRawBodyString(request);
      const payloadToSign = `${timestamp}|${nonce}|${rawBody}`;
      const hmac = crypto.createHmac("sha256", secret).update(payloadToSign).digest();

      let providedSignature: Buffer;
      try {
        providedSignature = Buffer.from(signature, "hex");
      } catch {
        return reply.code(401).send({ error: "invalid_signature" });
      }

      if (providedSignature.length !== hmac.length) {
        return reply.code(401).send({ error: "invalid_signature" });
      }

      if (!crypto.timingSafeEqual(hmac, providedSignature)) {
        return reply.code(401).send({ error: "invalid_signature" });
      }

      const nonceKey = `${NONCE_KEY_PREFIX}${nonce}`;
      const nonceStored = await fastify.redis.set(nonceKey, String(timestamp), "NX", "EX", FIVE_MINUTES_SECONDS);
      if (nonceStored !== "OK") {
        return reply.code(409).send({ error: "nonce_replay" });
      }

      return reply.code(202).send({ received: true });
    },
  });
};

export default webhooksRoutes;
