import type { FastifyPluginAsync } from "fastify";

const buildReportId = () =>
  `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/dashboard/generate-report",
    async (request, reply) => {
      const idempotencyKey = request.headers["idempotency-key"];
      const cacheKey = typeof idempotencyKey === "string" && idempotencyKey.length > 0
        ? `reports:${idempotencyKey}`
        : null;

      if (cacheKey) {
        const cached = await fastify.redis.get<string>(cacheKey);
        if (cached) {
          return reply.code(200).send({ reportId: cached });
        }
      }

      const reportId = buildReportId();

      if (cacheKey) {
        await fastify.redis.set(cacheKey, reportId);
      }

      return reply.code(200).send({ reportId });
    }
  );

  fastify.get(
    "/dashboard/report/:id/download",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const pdfBuffer = Buffer.from("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "utf-8");
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename=\"${id}.pdf\"`)
        .send(pdfBuffer);
    }
  );
};
