import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { context, trace, ROOT_CONTEXT } from '@opentelemetry/api';
import { randomUUID, randomBytes } from 'crypto';

function generateTraceId(): string {
  // 16 bytes hex per W3C (32 chars)
  return randomBytes(16).toString('hex');
}
function generateSpanId(): string {
  // 8 bytes hex per W3C (16 chars)
  return randomBytes(8).toString('hex');
}

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
    // store on req
    (req as any).traceId = parsed.traceId;
    (req as any).spanId = parsed.spanId;
    // echo / set on response
    reply.header('traceparent', `00-${parsed.traceId}-${parsed.spanId}-${parsed.sampled}`);
    reply.header('x-trace-id', parsed.traceId);

    // bind a basic OTel span context if users later integrate a real SDK
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
