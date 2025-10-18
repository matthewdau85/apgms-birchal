import type { FastifyRequest } from "fastify";
import { secLog } from "./logger.js";
import { extractOrgId, extractPrincipal, resolveRoute } from "./security-context.js";

type VerifyOptions = {
  principal?: string;
  orgId?: string;
  decision?: string;
};

const resolveReason = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "verify_failed";
};

export const verifyRpt = async <T>(
  request: FastifyRequest,
  action: () => Promise<T>,
  options: VerifyOptions = {},
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    secLog("rpt_verify_failed", {
      decision: options.decision ?? "reject",
      route: resolveRoute(request),
      principal: options.principal ?? extractPrincipal(request),
      orgId: options.orgId ?? extractOrgId(request),
      ip: request.ip,
      reason: resolveReason(error),
    });

    throw error;
  }
};
