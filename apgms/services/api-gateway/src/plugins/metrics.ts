import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import client from 'prom-client';

const DEFAULT_BUCKETS = [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10];

export const metricsPlugin: FastifyPluginAsync = fp(async (app) => {
  // Register default metrics once per process
  if (!(client as any).__apgms_registered) {
    client.collectDefaultMetrics();
    (client as any).__apgms_registered = true;
  }

  const httpHistogram = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method','route','status_code','trace_id'],
    buckets: DEFAULT_BUCKETS,
  });

  const httpCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method','route','status_code','trace_id'],
  });

  // Observe every request/response
  app.addHook('onRequest', async (req) => {
    (req as any).__metricsStart = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as any).__metricsStart as bigint | undefined;
    const end = process.hrtime.bigint();
    const diffNs = start ? Number(end - start) : 0;
    const seconds = diffNs / 1e9;

    const method = (req.method || 'GET').toUpperCase();
    // Fastify sets context.config.url when route is known; fallback to req.routerPath or req.url
    // @ts-ignore
    const route = (reply.context?.config?.url) || (req as any).routerPath || req.url || 'unknown';
    const status = String(reply.statusCode || 200);
    const traceId = (req as any).traceId || 'none';

    httpHistogram.observe({ method, route, status_code: status, trace_id: traceId }, seconds);
    httpCounter.inc({ method, route, status_code: status, trace_id: traceId });
  });

  // Expose metrics endpoint
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', client.register.contentType);
    return client.register.metrics();
  });
});

export default metricsPlugin;
