import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';

function generateTraceId(): string { return randomBytes(16).toString('hex'); }
function generateSpanId(): string { return randomBytes(8).toString('hex'); }

function parseOrCreateTraceparent(inbound?: string): { traceId: string; spanId: string; sampled: string } {
  try {
    if (inbound && inbound.startsWith('00-')) {
      const parts = inbound.split('-');
      if (parts.length >= 4) {
        const [ , traceId, spanId, flags ] = parts;
        if (traceId?.length === 32 && spanId?.length === 16) {
          return { traceId, spanId, sampled: flags || '01' };
        }
      }
    }
  } catch {}
  return { traceId: generateTraceId(), spanId: generateSpanId(), sampled: '01' };
}

export const tracingPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    const inbound = (req.headers['traceparent'] as string | undefined);
    const parsed = parseOrCreateTraceparent(inbound);
    (req as any).traceId = parsed.traceId;
    (req as any).spanId = parsed.spanId;
    reply.header('traceparent', `00-${parsed.traceId}-${parsed.spanId}-${parsed.sampled}`);
    reply.header('x-trace-id', parsed.traceId);
  });
});

export default tracingPlugin;
