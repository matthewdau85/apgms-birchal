import type { FastifyPluginAsync } from "fastify";
import { createBankLine, listBankLines } from "../data/store.js";
import {
  BANK_LINE_CREATE_SCHEMA,
  BANK_LINE_LIST_SCHEMA,
  BANK_LINE_QUERY_SCHEMA,
  BANK_LINE_SCHEMA,
} from "../schemas/bank-lines.js";
import { parseOrFail } from "../utils/validation.js";
import { withIdempotency } from "../utils/idempotency.js";

export const bankLinesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/bank-lines", async (request, reply) => {
    const rawQuery = request.query as Record<string, unknown>;
    const rawTake = rawQuery?.take as unknown;
    let invalidTake = false;
    let take: number | undefined;
    if (typeof rawTake === "number") {
      take = rawTake;
    } else if (typeof rawTake === "string" && rawTake.trim() !== "") {
      const parsed = Number(rawTake);
      if (Number.isFinite(parsed)) {
        take = parsed;
      } else {
        invalidTake = true;
      }
    } else if (rawTake !== undefined && rawTake !== null) {
      invalidTake = true;
    }

    if (invalidTake) {
      reply.code(400).send({ error: "validation_error", context: "bank_lines_query" });
      return;
    }

    const normalized = {
      take,
      cursor:
        typeof rawQuery?.cursor === "string" && rawQuery.cursor.trim() !== ""
          ? rawQuery.cursor
          : undefined,
    };

    const query = parseOrFail(BANK_LINE_QUERY_SCHEMA, normalized, request, reply, "bank_lines_query");
    if (!query) {
      return;
    }

    try {
      const result = listBankLines(query);
      const response = BANK_LINE_LIST_SCHEMA.parse(result);
      request.log.info({ count: response.items.length }, "bank lines retrieved");
      return response;
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_cursor") {
        reply.code(400).send({ error: "invalid_cursor" });
        return;
      }
      request.log.error({ err: error }, "failed to list bank lines");
      reply.code(500).send({ error: "internal_error" });
    }
  });

  app.post(
    "/bank-lines",
    withIdempotency(async (request, reply) => {
      const body = parseOrFail(
        BANK_LINE_CREATE_SCHEMA,
        request.body ?? {},
        request,
        reply,
        "bank_lines_create",
      );
      if (!body) {
        return;
      }

      const created = createBankLine(body);
      const response = BANK_LINE_SCHEMA.parse(created);
      reply.code(201);
      request.log.info({ bankLineId: response.id }, "bank line created");
      return response;
    }),
  );
};
