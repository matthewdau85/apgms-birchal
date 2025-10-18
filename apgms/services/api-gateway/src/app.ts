import { createHmac } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import { config } from "./config.js";
import {
  authenticateRequest,
  shouldSkipAuth,
} from "./auth.js";
import { enforceRateLimit } from "./rate-limit.js";
import {
  formatSuccessPayload,
  sendError,
  sendSuccess,
} from "./response.js";
import {
  auditReportSchema,
  bankLineCreateSchema,
  bankLineListResponseSchema,
  bankLineResponseSchema,
  paginationQuerySchema,
  userListResponseSchema,
  webhookAcceptedResponseSchema,
  webhookPayloadSchema,
} from "./schemas.js";
import { withIdempotency } from "./idempotency.js";
import {
  appendAuditEntry,
  getAuditEntry,
  verifyAuditTrail,
} from "./audit.js";

const REPLAY_CACHE = new Map<string, number>();
const MAX_WEBHOOK_SKEW_MS = 5 * 60 * 1000;

function serializeBankLine(bankLine: any) {
  return {
    id: String(bankLine.id),
    orgId: String(bankLine.orgId),
    date: new Date(bankLine.date).toISOString(),
    amount: Number(bankLine.amount),
    payee: bankLine.payee,
    desc: bankLine.desc,
    createdAt: new Date(bankLine.createdAt).toISOString(),
  };
}

function isTrustedOrigin(origin: string) {
  return config.corsOrigins.includes(origin);
}

function cleanupReplayCache() {
  const now = Date.now();
  for (const [nonce, expiry] of REPLAY_CACHE.entries()) {
    if (expiry <= now) {
      REPLAY_CACHE.delete(nonce);
    }
  }
}

export async function createApp() {
  const app = Fastify({ logger: true, bodyLimit: config.bodyLimit });

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isTrustedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
    credentials: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    cleanupReplayCache();
    if (shouldSkipAuth(request.routerPath ?? request.url)) {
      return;
    }

    enforceRateLimit(request, reply);
    if (reply.sent) {
      return;
    }

    const auth = authenticateRequest(request, reply);
    if (!auth) {
      return;
    }
    request.auth = auth;
  });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async (request, reply) => {
    if (!request.auth) {
      return reply;
    }
    const users = await prisma.user.findMany({
      where: { orgId: request.auth.orgId },
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const payload = {
      users: users.map((user) => ({
        email: user.email,
        orgId: String(user.orgId),
        createdAt: new Date(user.createdAt).toISOString(),
      })),
    };

    return sendSuccess(reply, userListResponseSchema, payload);
  });

  app.get("/bank-lines", async (request, reply) => {
    if (!request.auth) {
      return reply;
    }

    const query = paginationQuerySchema.parse(request.query ?? {});

    const lines = await prisma.bankLine.findMany({
      where: { orgId: request.auth.orgId },
      orderBy: { date: "desc" },
      take: query.take,
    });

    const payload = {
      lines: lines.map(serializeBankLine),
    };

    return sendSuccess(reply, bankLineListResponseSchema, payload);
  });

  app.post("/bank-lines", async (request, reply) => {
    if (!request.auth) {
      return reply;
    }

    await withIdempotency(request, reply, async () => {
      try {
        const body = bankLineCreateSchema.parse(request.body ?? {});
        const created = await prisma.bankLine.create({
          data: {
            orgId: request.auth!.orgId,
            date: body.date,
            amount: body.amount,
            payee: body.payee,
            desc: body.desc,
          },
        });

        const response = formatSuccessPayload(
          bankLineResponseSchema,
          serializeBankLine(created)
        );

        return { statusCode: 201, body: response };
      } catch (error) {
        request.log.error(error);
        return {
          statusCode: 400,
          body: {
            error: {
              code: "bad_request",
              message: "Unable to create bank line",
            },
          },
        };
      }
    });
  });

  app.post("/webhooks/intake", async (request, reply) => {
    if (!request.auth) {
      return reply;
    }

    await withIdempotency(request, reply, async () => {
      const nonceHeader = request.headers["x-webhook-nonce"];
      const timestampHeader = request.headers["x-webhook-timestamp"];
      const signatureHeader = request.headers["x-webhook-signature"];

      const nonce = Array.isArray(nonceHeader) ? nonceHeader[0] : nonceHeader;
      const timestampRaw = Array.isArray(timestampHeader)
        ? timestampHeader[0]
        : timestampHeader;
      const signature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader;

      if (!nonce || !timestampRaw || !signature) {
        return {
          statusCode: 400,
          body: {
            error: {
              code: "missing_signature_headers",
              message: "Nonce, timestamp and signature headers are required",
            },
          },
        };
      }

      const timestamp = Number(timestampRaw);
      if (!Number.isFinite(timestamp)) {
        return {
          statusCode: 400,
          body: {
            error: {
              code: "invalid_timestamp",
              message: "Invalid webhook timestamp",
            },
          },
        };
      }

      const now = Date.now();
      if (Math.abs(now - timestamp) > MAX_WEBHOOK_SKEW_MS) {
        return {
          statusCode: 400,
          body: {
            error: {
              code: "stale_webhook",
              message: "Webhook timestamp outside allowable window",
            },
          },
        };
      }

      const cached = REPLAY_CACHE.get(nonce);
      if (cached && cached > now) {
        return {
          statusCode: 409,
          body: {
            error: {
              code: "webhook_replay",
              message: "Webhook nonce already seen",
            },
          },
        };
      }

      const parsedPayload = webhookPayloadSchema.safeParse(request.body ?? {});
      if (!parsedPayload.success) {
        return {
          statusCode: 400,
          body: {
            error: {
              code: "invalid_webhook_payload",
              message: "Webhook payload validation failed",
              details: parsedPayload.error.flatten(),
            },
          },
        };
      }
      const payload = parsedPayload.data;
      const payloadString = JSON.stringify({
        ...payload,
        occurredAt: payload.occurredAt.toISOString(),
      });

      const expectedSignature = createHmac("sha256", config.webhookSecret)
        .update(`${nonce}:${timestampRaw}:${payloadString}`)
        .digest("hex");

      if (expectedSignature !== signature) {
        return {
          statusCode: 401,
          body: {
            error: {
              code: "invalid_signature",
              message: "Webhook signature validation failed",
            },
          },
        };
      }

      REPLAY_CACHE.set(nonce, now + MAX_WEBHOOK_SKEW_MS);

      const auditEntry = appendAuditEntry(payload.id, {
        type: payload.type,
        orgId: request.auth.orgId,
        receivedAt: new Date().toISOString(),
        payload: payload.data,
      });

      const response = formatSuccessPayload(
        webhookAcceptedResponseSchema,
        {
          received: true,
          auditId: auditEntry.id,
        }
      );

      return { statusCode: 202, body: response };
    });
  });

  app.get("/audit/rpt/:id", async (request, reply) => {
    if (!request.auth) {
      return reply;
    }

    const params = request.params as { id: string };
    const entry = getAuditEntry(params.id);

    if (!entry) {
      return sendError(reply, 404, "audit_not_found", "Audit entry not found");
    }

    const verification = verifyAuditTrail(params.id);
    const response = {
      id: params.id,
      valid: verification.valid,
      entry: {
        id: entry.id,
        prevHash: entry.prevHash,
        hash: entry.hash,
        timestamp: entry.timestamp,
        payload: entry.payload,
      },
    };

    return sendSuccess(reply, auditReportSchema, response);
  });

  return app;
}
