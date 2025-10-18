import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { secLog } from "../lib/logger.js";
import {
  extractOrgId,
  extractPrincipal,
  resolveRoute,
} from "../lib/security-context.js";

type HeadersSnapshot = Record<string, number | string | string[] | undefined>;

type IdempotencyRecord = {
  method: string;
  bodyHash: string;
  statusCode: number;
  payload: string;
  headers: HeadersSnapshot;
};

type IdempotencyContext = {
  key: string;
  bodyHash: string;
};

const idempotencyStore = new Map<string, IdempotencyRecord>();
const kContext = Symbol("idempotencyContext");

type RequestWithContext = FastifyRequest & {
  [kContext]?: IdempotencyContext;
};

const hashBody = (body: unknown) => {
  const normalized = (() => {
    if (body === undefined) {
      return "undefined";
    }

    if (body === null) {
      return "null";
    }

    if (typeof body === "string") {
      return body;
    }

    if (Buffer.isBuffer(body)) {
      return body.toString("utf8");
    }

    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  })();

  return createHash("sha256").update(normalized).digest("hex");
};

const stringifyPayload = (payload: unknown) => {
  if (payload === undefined || payload === null) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (Buffer.isBuffer(payload)) {
    return payload.toString("utf8");
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const sendConflict = (
  request: FastifyRequest,
  reply: FastifyReply,
  reason: string,
) => {
  secLog("idempotency", {
    decision: "conflict",
    route: resolveRoute(request),
    principal: extractPrincipal(request),
    orgId: extractOrgId(request),
    ip: request.ip,
    reason,
  });

  reply.code(409).send({ error: "idempotency_conflict", reason });
};

const sendReplay = (
  request: FastifyRequest,
  reply: FastifyReply,
  record: IdempotencyRecord,
) => {
  secLog("idempotency", {
    decision: "replay_reject",
    route: resolveRoute(request),
    principal: extractPrincipal(request),
    orgId: extractOrgId(request),
    ip: request.ip,
    reason: "replayed_request",
  });

  reply.code(record.statusCode);
  for (const [header, value] of Object.entries(record.headers)) {
    if (header.toLowerCase() === "content-length") {
      continue;
    }

    reply.header(header, value as any);
  }

  reply.send(record.payload);
};

export const registerIdempotencyMiddleware = (app: FastifyInstance) => {
  app.addHook("preHandler", async (request, reply) => {
    const headerValue = request.headers["idempotency-key"];
    const key = typeof headerValue === "string" ? headerValue.trim() : undefined;

    if (!key) {
      return;
    }

    const bodyHash = hashBody(request.body);
    const existing = idempotencyStore.get(key);

    if (!existing) {
      (request as RequestWithContext)[kContext] = {
        key,
        bodyHash,
      } satisfies IdempotencyContext;
      return;
    }

    if (existing.method !== request.method || existing.bodyHash !== bodyHash) {
      sendConflict(request, reply, "payload_mismatch");
      return reply;
    }

    sendReplay(request, reply, existing);
    return reply;
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const context = (request as RequestWithContext)[kContext];

    if (!context) {
      return payload;
    }

    if (reply.statusCode >= 500) {
      return payload;
    }

    const headersSnapshot: HeadersSnapshot = {};
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      headersSnapshot[name] = value as HeadersSnapshot[string];
    }

    idempotencyStore.set(context.key, {
      method: request.method,
      bodyHash: context.bodyHash,
      statusCode: reply.statusCode,
      payload: stringifyPayload(payload),
      headers: headersSnapshot,
    });

    delete (request as RequestWithContext)[kContext];

    return payload;
  });
};
