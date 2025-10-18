import type { FastifyPluginAsync } from "fastify";
import { createPolicy, listPolicies } from "../data/store.js";
import {
  POLICY_CREATE_SCHEMA,
  POLICY_LIST_SCHEMA,
  POLICY_SCHEMA,
} from "../schemas/policies.js";
import { parseOrFail } from "../utils/validation.js";
import { withIdempotency } from "../utils/idempotency.js";

function normalizePolicyPayload(raw: unknown) {
  const body = raw as Record<string, unknown> | undefined;
  return {
    name: body?.name,
    description: body?.description,
    rules: Array.isArray(body?.rules) ? body.rules : body?.rules,
  };
}

export const policyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/policies", async (request) => {
    const policies = listPolicies();
    const response = POLICY_LIST_SCHEMA.parse({ items: policies });
    request.log.info({ count: response.items.length }, "policies retrieved");
    return response;
  });

  app.post(
    "/policies",
    withIdempotency(async (request, reply) => {
      const normalized = normalizePolicyPayload(request.body);
      const payload = parseOrFail(
        POLICY_CREATE_SCHEMA,
        normalized,
        request,
        reply,
        "policies_create",
      );
      if (!payload) {
        return;
      }

      const created = createPolicy({
        name: payload.name,
        description: payload.description,
        rules: payload.rules,
      });
      const response = POLICY_SCHEMA.parse(created);
      reply.code(201);
      request.log.info({ policyId: response.id }, "policy created");
      return response;
    }),
  );
};
