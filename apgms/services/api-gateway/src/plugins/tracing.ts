import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { randomBytes } from 'crypto';

function genTraceId() { return randomBytes(16).toString('hex'); }
function genSpanId() { return randomBytes(8).toString('hex'); }

function parseOrCreate(inbound?: string) {
  try {
    if (inbound?.startsWith('00-')) {
      const [ , traceId, spanId, flags ] = inbound.split('-');
      if (traceId?.length === 32 && spanId?.length === 16) return { traceId, spanId, sampled: flags || '01' };
    }
  } catch {}
  return { traceId: genTraceId(), spanId: genSpanId(), sampled: '01' };
}

export const tracingPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    const parsed = parseOrCreate(req.headers['traceparent'] as string | undefined);
    (req as any).traceId = parsed.traceId;
    (req as any).spanId = parsed.spanId;
    reply.header('traceparent', `00-${parsed.traceId}-${parsed.spanId}-${parsed.sampled}`);
    reply.header('x-trace-id', parsed.traceId);
    const tracer = trace.getTracer('apgms-gateway');
    const span = tracer.startSpan('http_request', undefined, ROOT_CONTEXT);
    (req as any).__span = span;
  });
  app.addHook('onResponse', async (req) => {
    const span = (req as any).__span;
    if (span && typeof span.end === 'function') span.end();
  });
});
export default tracingPlugin;
