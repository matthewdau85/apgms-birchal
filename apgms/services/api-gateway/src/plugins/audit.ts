import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

type AuditRecord = {
  ts: string; method: string; url: string; status: number;
  requestId?: string; userId?: string; orgId?: string;
};

declare module 'fastify' {
  interface FastifyInstance { auditSink: AuditRecord[]; }
}

export const auditPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorate('auditSink', [] as AuditRecord[]);
  app.addHook('onResponse', async (req, reply) => {
    const m = (req.method || '').toUpperCase();
    if (!['POST','PUT','PATCH','DELETE'].includes(m)) return;
    const rec: AuditRecord = {
      ts: new Date().toISOString(),
      method: m,
      url: req.url,
      status: reply.statusCode,
      requestId: (req as any).requestId,
      userId: (req as any).user?.id,
      orgId: (req as any).orgId,
    };
    app.auditSink.push(rec);
    if (process.env.NODE_ENV !== 'test') app.log.info({ audit: rec }, 'mutation_audit');
  });
});

export default auditPlugin;
