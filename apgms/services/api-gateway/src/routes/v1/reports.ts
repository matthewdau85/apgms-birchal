import { FastifyInstance } from 'fastify';
import { ReportRequestSchema, ReportOutSchema } from '../../../../packages/shared/src/schemas/report';
import { fromZodError } from 'zod-validation-error';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createHash } from 'crypto';

const ReportRequestJSON = zodToJsonSchema(ReportRequestSchema, 'ReportRequest');
const ReportOutJSON     = zodToJsonSchema(ReportOutSchema, 'ReportOut');

export async function reportsRoutes(app: FastifyInstance) {
  app.post('/dashboard/generate-report', {
    schema: {
      description: 'Generate a report for the given period',
      tags: ['reports'],
      body: ReportRequestJSON as any,
      response: {
        200: ReportOutJSON as any,
        401: { type: 'object', properties: { code: { type: 'string' } } },
        422: { type: 'object', properties: { code: { type: 'string' }, errors: { type: 'object' } } },
      },
      security: [{ bearerAuth: [] }],
    }
  }, async (req, reply) => {
    const parsed = ReportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({ code: 'INVALID_BODY', errors: fromZodError(parsed.error) });
    }

    // @ts-ignore
    const orgId = (req as any).orgId || 'demo-org';
    const idemKey = (req.headers['idempotency-key'] as string | undefined);
    const bodyHash = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
    const cacheKey = `report:${orgId}:${idemKey ?? bodyHash}`;

    if ((app as any).redis) {
      const existing = await (app as any).redis.get(cacheKey);
      if (existing) return reply.send({ reportId: existing });
    }

    const reportId = `${orgId}-${Date.now()}`;
    if ((app as any).redis) await (app as any).redis.set(cacheKey, reportId, 'EX', 3600);

    reply.send({ reportId });
  });

  app.get('/dashboard/report/:id/download', {
    schema: {
      description: 'Download a generated report PDF by id',
      tags: ['reports'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: { description: 'PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
        401: { type: 'object', properties: { code: { type: 'string' } } },
        403: { type: 'object', properties: { code: { type: 'string' } } },
      },
      security: [{ bearerAuth: [] }],
    }
  }, async (req, reply) => {
    const { id } = (req.params as any);
    // @ts-ignore
    const orgId = (req as any).orgId || 'demo-org';

    const pdf = Buffer.from('%PDF-1.4\n%...replace with actual pdf...\n', 'utf8');
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="apgms-report-${id}.pdf"`)
      .send(pdf);
  });
}
