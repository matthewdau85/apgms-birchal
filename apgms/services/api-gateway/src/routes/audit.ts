import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { getAuditReport, listLedger } from "../data/store.js";
import {
  AUDIT_LEDGER_QUERY_SCHEMA,
  AUDIT_LEDGER_SCHEMA,
  AUDIT_REPORT_SCHEMA,
} from "../schemas/audit.js";
import { parseOrFail } from "../utils/validation.js";

const REPORT_PARAMS_SCHEMA = z.object({ id: z.string().min(1) });

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get("/audit/rpt/:id", async (request, reply) => {
    const params = parseOrFail(REPORT_PARAMS_SCHEMA, request.params, request, reply, "audit_report_params");
    if (!params) {
      return;
    }

    const report = getAuditReport(params.id);
    if (!report) {
      reply.code(404).send({ error: "report_not_found" });
      return;
    }

    const response = AUDIT_REPORT_SCHEMA.parse(report);
    request.log.info({ orgId: params.id }, "audit report generated");
    return response;
  });

  app.get("/audit/ledger", async (request, reply) => {
    const rawQuery = request.query as Record<string, unknown>;
    const normalized = {
      orgId:
        typeof rawQuery?.orgId === "string" && rawQuery.orgId.trim() !== ""
          ? rawQuery.orgId
          : undefined,
    };
    const query = parseOrFail(
      AUDIT_LEDGER_QUERY_SCHEMA,
      normalized,
      request,
      reply,
      "audit_ledger_query",
    );
    if (!query) {
      return;
    }

    const ledger = listLedger(query.orgId);
    const response = AUDIT_LEDGER_SCHEMA.parse(ledger);
    request.log.info({ count: response.count }, "audit ledger returned");
    return response;
  });
};
