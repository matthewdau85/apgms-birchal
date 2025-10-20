import { FastifyPluginAsync } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";

import {
  cashFlowReportQuerySchema,
  cashFlowReportTag,
} from "@apgms/shared/schemas/report";

const cashFlowReportQueryJsonSchema = {
  type: "object",
  description: cashFlowReportQuerySchema.description,
  required: ["orgId"],
  properties: {
    orgId: {
      type: "string",
      description: "Unique identifier for the organisation to build the report for.",
      minLength: 1,
    },
    from: {
      type: "string",
      format: "date-time",
      description: "Optional inclusive lower bound for the reporting window.",
    },
    to: {
      type: "string",
      format: "date-time",
      description: "Optional inclusive upper bound for the reporting window.",
    },
  },
};

const validationIssueJsonSchema = {
  type: "object",
  required: ["path", "message", "code"],
  properties: {
    path: {
      type: "array",
      items: {
        oneOf: [
          { type: "string" },
          { type: "number" },
        ],
      },
      description: "Location of the issue within the payload.",
    },
    message: {
      type: "string",
      description: "Human readable validation error message.",
    },
    code: {
      type: "string",
      description: "Zod error code for the issue.",
    },
  },
};

const validationErrorJsonSchema = {
  type: "object",
  required: ["statusCode", "error", "message", "issues"],
  properties: {
    statusCode: {
      type: "integer",
      enum: [400],
    },
    error: {
      type: "string",
      enum: ["Bad Request"],
    },
    message: {
      type: "string",
    },
    issues: {
      type: "array",
      items: validationIssueJsonSchema,
    },
  },
};

const cashFlowReportResponseJsonSchema = {
  type: "object",
  required: ["report"],
  properties: {
    report: {
      type: "object",
      required: ["id", "orgId", "generatedAt", "currency", "period", "totals", "linesAnalyzed"],
      properties: {
        id: { type: "string", description: "Opaque identifier for this generated report." },
        orgId: {
          type: "string",
          description: "Identifier for the organisation the report was generated for.",
        },
        generatedAt: {
          type: "string",
          format: "date-time",
          description: "Timestamp indicating when the report was produced.",
        },
        currency: {
          type: "string",
          description: "Currency code used for the monetary fields.",
        },
        period: {
          type: "object",
          required: ["from", "to"],
          properties: {
            from: { type: ["string", "null"], format: "date-time" },
            to: { type: ["string", "null"], format: "date-time" },
          },
        },
        totals: {
          type: "object",
          required: ["inflow", "outflow", "net"],
          properties: {
            inflow: { type: "number", description: "Total sum of positive bank line amounts." },
            outflow: {
              type: "number",
              description: "Total sum of absolute values for negative bank line amounts.",
            },
            net: {
              type: "number",
              description: "Net total (inflow minus outflow) over the provided time period.",
            },
          },
        },
        linesAnalyzed: {
          type: "integer",
          minimum: 0,
          description: "Number of bank transaction rows that contributed to the totals.",
        },
      },
    },
  },
};

let cachedPrisma: PrismaClient | null = null;

async function loadPrisma(): Promise<PrismaClient | null> {
  if (cachedPrisma) {
    return cachedPrisma;
  }

  try {
    const module = await import("@apgms/shared/db");
    cachedPrisma = module.prisma;
    return cachedPrisma;
  } catch (error) {
    return null;
  }
}

const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/v1/reports/cashflow",
    {
      schema: {
        tags: [cashFlowReportTag],
        summary: "Summarise cash flow for an organisation",
        description:
          "Aggregates bank lines for the requested organisation and returns inflow, outflow and net totals.",
        querystring: cashFlowReportQueryJsonSchema,
        response: {
          200: cashFlowReportResponseJsonSchema,
          400: validationErrorJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const parsedQuery = cashFlowReportQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        const { error } = parsedQuery;
        const issues = error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        }));
        const message = issues
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "query";
            return `${path}: ${issue.message}`;
          })
          .join("; ");

        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message,
          issues,
        });
      }

      const { orgId, from, to } = parsedQuery.data;

      const where: Prisma.BankLineWhereInput = { orgId };
      if (from || to) {
        where.date = {};
        if (from) {
          where.date.gte = new Date(from);
        }
        if (to) {
          where.date.lte = new Date(to);
        }
      }

      type Line = { amount: number };

      let lines: Line[] = [];
      const prisma = await loadPrisma();
      if (prisma) {
        try {
          const results = await prisma.bankLine.findMany({
            where,
            select: {
              amount: true,
            },
          });
          lines = results.map((result) => ({
            amount: Number(result.amount),
          }));
        } catch (error) {
          request.log.warn(
            { err: error },
            "failed to load bank lines for cashflow report; returning zeroed totals",
          );
        }
      } else {
        request.log.debug(
          { orgId },
          "Prisma client unavailable when generating cashflow report; returning zeroed totals",
        );
      }

      const totals = lines.reduce(
        (acc, line) => {
          const value = Number.isFinite(line.amount) ? line.amount : 0;
          if (value >= 0) {
            acc.inflow += value;
          } else {
            acc.outflow += Math.abs(value);
          }
          return acc;
        },
        { inflow: 0, outflow: 0 },
      );

      const response = {
        report: {
          id: `cashflow-${orgId}`,
          orgId,
          generatedAt: new Date().toISOString(),
          currency: "AUD",
          period: {
            from: from ?? null,
            to: to ?? null,
          },
          totals: {
            inflow: Number(totals.inflow.toFixed(2)),
            outflow: Number(totals.outflow.toFixed(2)),
            net: Number((totals.inflow - totals.outflow).toFixed(2)),
          },
          linesAnalyzed: lines.length,
        },
      };

      return reply.status(200).send(response);
    },
  );
};

export default reportsRoutes;
