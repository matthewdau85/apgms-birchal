import type { FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";

const ReportRequest = z.object({
  reportType: z.enum([
    "COMPLIANCE_SUMMARY",
    "PAYMENT_HISTORY",
    "TAX_OBLIGATIONS",
    "DISCREPANCY_LOG",
  ]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/dashboard/generate-report", async (req, reply) => {
    const parsed = ReportRequest.safeParse(req.body);

    if (!parsed.success) {
      return reply
        .code(422)
        .send({ code: "INVALID_BODY", errors: parsed.error.format() });
    }

    // TODO: use auth/org hooks when available to resolve orgId/userId
    const orgId = (req as any).orgId ?? "demo-org";
    const idemKey = req.headers["idempotency-key"] as string | undefined;

    const bodyHash = createHash("sha256")
      .update(JSON.stringify(parsed.data))
      .digest("hex");
    const cacheKey = `report:${orgId}:${idemKey ?? bodyHash}`;

    if (app.redis) {
      const existing = await app.redis.get(cacheKey);
      if (existing) {
        return reply.send({ reportId: existing });
      }
    }

    const reportId = `${orgId}-${Date.now()}`;

    if (app.redis) {
      await app.redis.set(cacheKey, reportId, "EX", 3600);
    }

    // TODO: enqueue async generation job or persist request details with orgId/userId
    return reply.send({ reportId });
  });

  app.get("/dashboard/report/:id/download", async (req, reply) => {
    const { id } = req.params as { id: string };
    const orgId = (req as any).orgId ?? "demo-org";

    // TODO: ensure report `id` belongs to `orgId` once persistence exists

    const pdfBytes = Buffer.from(
      "%PDF-1.4\n%…replace with real pdf bytes…\n",
      "utf8",
    );

    reply
      .header("Content-Type", "application/pdf")
      .header(
        "Content-Disposition",
        `attachment; filename="apgms-report-${id}.pdf"`,
      )
      // TODO: stream actual binary data from storage
      .send(pdfBytes);
  });
};
