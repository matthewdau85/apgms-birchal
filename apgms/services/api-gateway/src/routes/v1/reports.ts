import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withIdempotency, storeIdempotentResult } from '../../utils/idempotency';

const generateReportBodySchema = z.object({
  reportType: z.string(),
  startDate: z.string(),
  endDate: z.string()
});

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/dashboard/generate-report', async (req, reply) => {
    const parsed = generateReportBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'INVALID_BODY',
        details: parsed.error.flatten()
      });
    }

    const orgId = (req as any).orgId || 'demo-org';
    const cacheKey = await withIdempotency(app, req, reply, orgId, parsed.data);
    if (cacheKey === null) {
      // No redis; proceed as normal
    } else {
      if (reply.getHeader('Idempotent-Replay') === 'true') {
        const existing = await (app as any).redis.get(cacheKey);
        return reply.send({ reportId: existing });
      }
    }

    const reportId = `${orgId}-${Date.now()}`;

    if (cacheKey) await storeIdempotentResult(app, cacheKey, reportId);

    reply.send({ reportId });
  });
};

export default reportsRoutes;
