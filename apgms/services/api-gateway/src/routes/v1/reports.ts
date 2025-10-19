import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  ReportOutSchema,
  ReportRequestSchema,
} from "@apgms/shared/src/schemas/report";

const ReportDownloadParamsSchema = z.object({
  id: z.string().min(1),
});

const reportsRoutes: FastifyPluginAsync = async (app) => {
  const reportRequestJson = app.jsonSchemaFromZod(
    ReportRequestSchema,
    "ReportRequest",
  );
  const reportOutJson = app.jsonSchemaFromZod(ReportOutSchema, "ReportOut");
  const reportDownloadParamsJson = app.jsonSchemaFromZod(
    ReportDownloadParamsSchema,
    "ReportDownloadParams",
  );

  app.post(
    "/dashboard/generate-report",
    {
      schema: {
        tags: ["Reports"],
        summary: "Generate a dashboard report",
        body: reportRequestJson,
        response: {
          200: reportOutJson,
          422: {
            type: "object",
            properties: {
              error: { type: "string" },
              issues: { type: "array" },
            },
            required: ["error", "issues"],
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = ReportRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({
          error: "validation_error",
          issues: parsed.error.issues,
        });
      }

      const reportId = `report_${Date.now()}`;
      return reply.send({ reportId });
    },
  );

  app.get(
    "/dashboard/report/:id/download",
    {
      schema: {
        tags: ["Reports"],
        summary: "Download a generated dashboard report",
        params: reportDownloadParamsJson,
        response: {
          200: {
            description: "PDF document",
            content: {
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = ReportDownloadParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "invalid_report_id" });
      }

      const pdfContent = [
        "%PDF-1.4",
        "%âãÏÓ",
        "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
        "2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj",
        "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>endobj",
        "4 0 obj<< /Length 44 >>stream",
        "BT /F1 24 Tf 50 150 Td (Report Ready) Tj ET",
        "endstream endobj",
        "xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000079 00000 n \n0000000177 00000 n \n0000000331 00000 n \ntrailer<< /Root 1 0 R /Size 5 >>\nstartxref\n447\n%%EOF",
      ].join("\n");

      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `attachment; filename="${parsed.data.id}.pdf"`,
      );
      return reply.send(Buffer.from(pdfContent));
    },
  );
};

export default reportsRoutes;
