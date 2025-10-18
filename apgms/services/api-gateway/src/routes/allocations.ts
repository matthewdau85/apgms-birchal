import type { FastifyPluginAsync } from "fastify";
import {
  applyAllocations,
  previewAllocations,
} from "../data/store.js";
import {
  ALLOCATION_APPLY_RESPONSE_SCHEMA,
  ALLOCATION_PREVIEW_RESPONSE_SCHEMA,
  ALLOCATION_REQUEST_SCHEMA,
} from "../schemas/allocations.js";
import { parseOrFail } from "../utils/validation.js";
import { withIdempotency } from "../utils/idempotency.js";

function normalizeAllocationPayload(raw: unknown) {
  const body = raw as Record<string, unknown> | undefined;
  const linesRaw = Array.isArray(body?.lines) ? (body?.lines as Array<Record<string, unknown>>) : [];
  return {
    orgId: typeof body?.orgId === "string" ? body.orgId : body?.orgId,
    lines: linesRaw.map((line) => ({
      lineId: typeof line?.lineId === "string" ? line.lineId : line?.lineId,
      amount:
        typeof line?.amount === "number"
          ? line.amount
          : typeof line?.amount === "string"
          ? Number(line.amount)
          : line?.amount,
    })),
  };
}

export const allocationRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/allocations/preview",
    withIdempotency(async (request, reply) => {
      const normalized = normalizeAllocationPayload(request.body);
      const payload = parseOrFail(
        ALLOCATION_REQUEST_SCHEMA,
        normalized,
        request,
        reply,
        "allocations_preview",
      );
      if (!payload) {
        return;
      }

      const preview = previewAllocations(payload);
      const response = ALLOCATION_PREVIEW_RESPONSE_SCHEMA.parse(preview);
      request.log.info({ orgId: payload.orgId }, "allocation preview created");
      return response;
    }),
  );

  app.post(
    "/allocations/apply",
    withIdempotency(async (request, reply) => {
      const normalized = normalizeAllocationPayload(request.body);
      const payload = parseOrFail(
        ALLOCATION_REQUEST_SCHEMA,
        normalized,
        request,
        reply,
        "allocations_apply",
      );
      if (!payload) {
        return;
      }

      const result = applyAllocations(payload);
      const response = ALLOCATION_APPLY_RESPONSE_SCHEMA.parse(result);
      request.log.info({ orgId: payload.orgId }, "allocations applied");
      return response;
    }),
  );
};
