import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { ReportRequestSchema, ReportOutSchema } from "@apgms/shared";

const ReportRequestJsonSchema = {
  type: "object",
  required: ["reportType", "startDate", "endDate"],
  properties: {
    reportType: {
      type: "string",
      enum: [
        "COMPLIANCE_SUMMARY",
        "PAYMENT_HISTORY",
        "TAX_OBLIGATIONS",
        "DISCREPANCY_LOG",
      ],
    },
    startDate: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      description: "ISO date in YYYY-MM-DD format",
    },
    endDate: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      description: "ISO date in YYYY-MM-DD format",
    },
  },
};

const ReportOutJsonSchema = {
  type: "object",
  required: ["reportId"],
  properties: {
    reportId: { type: "string" },
  },
};

const ValidationErrorJsonSchema = {
  type: "object",
  required: ["statusCode", "error", "message", "issues"],
  properties: {
    statusCode: { type: "integer", const: 422 },
    error: { type: "string", const: "Unprocessable Entity" },
    message: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        required: ["path", "message"],
        properties: {
          path: {
            type: "array",
            items: {
              anyOf: [
                { type: "string" },
                { type: "number" },
              ],
            },
          },
          message: { type: "string" },
        },
      },
    },
  },
};

const ReportDownloadParamsJsonSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
  },
};

const ReportDownloadResponseJsonSchema = {
  type: "object",
  required: ["url"],
  properties: {
    url: { type: "string", format: "uri" },
  },
};

const ReportDownloadParamsSchema = z.object({
  id: z.string().min(1),
});

const buildValidationError = (error: z.ZodError) => ({
  statusCode: 422 as const,
  error: "Unprocessable Entity" as const,
  message: "Validation failed",
  issues: error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  })),
});

const sendValidationError = (reply: FastifyReply, error: z.ZodError) =>
  reply.status(422).send(buildValidationError(error));

export default async function reportsRoutes(app: FastifyInstance) {
  app.post(
    "/dashboard/generate-report",
    {
      schema: {
        tags: ["Reports"],
        summary: "Queue the generation of a compliance report",
        body: ReportRequestJsonSchema,
        response: {
          202: ReportOutJsonSchema,
          422: ValidationErrorJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = ReportRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error);
      }

      const { reportType, startDate, endDate } = parsed.data;

      app.log.info(
        { reportType, startDate, endDate },
        "queued report generation",
      );

      const payload = ReportOutSchema.parse({ reportId: randomUUID() });

      return reply.status(202).send(payload);
    },
  );

  app.get(
    "/dashboard/report/:id/download",
    {
      schema: {
        tags: ["Reports"],
        summary: "Retrieve the download link for a previously generated report",
        params: ReportDownloadParamsJsonSchema,
        response: {
          200: ReportDownloadResponseJsonSchema,
          404: {
            type: "object",
            required: ["statusCode", "error", "message"],
            properties: {
              statusCode: { type: "integer", const: 404 },
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          422: ValidationErrorJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = ReportDownloadParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return sendValidationError(reply, paramsResult.error);
      }

      const { id } = paramsResult.data;

      if (!id) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Report not found",
        });
      }

      return { url: `https://reports.apgms.local/${id}.pdf` };
    },
  );
}
