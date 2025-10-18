import type { FastifyInstance, FastifyRequest } from "fastify";
import { secLog } from "../lib/logger.js";
import {
  extractOrgId,
  extractPrincipal,
  resolveRoute,
} from "../lib/security-context.js";

const extractReason = (payload: unknown): string | undefined => {
  if (!payload) {
    return undefined;
  }

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object" && "reason" in parsed) {
        const reason = (parsed as Record<string, unknown>).reason;
        return typeof reason === "string" ? reason : undefined;
      }
    } catch {
      return undefined;
    }
  }

  if (typeof payload === "object" && !Buffer.isBuffer(payload)) {
    const reason = (payload as Record<string, unknown>).reason;
    return typeof reason === "string" ? reason : undefined;
  }

  return undefined;
};

export const registerAuthSecurityLogger = (app: FastifyInstance) => {
  app.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode !== 401 && reply.statusCode !== 403) {
      return payload;
    }

    secLog("auth_denied", {
      decision: reply.statusCode === 401 ? "unauthorized" : "forbidden",
      route: resolveRoute(request),
      principal: extractPrincipal(request),
      orgId: extractOrgId(request),
      ip: request.ip,
      reason: extractReason(payload),
    });

    return payload;
  });
};
