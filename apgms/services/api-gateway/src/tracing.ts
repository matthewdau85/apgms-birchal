import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";

const TRACE_OUTPUT_PATH = path.resolve(process.cwd(), "artifacts/traces.json");

interface RecordedSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: "SERVER";
  startTime: string;
  endTime?: string;
  attributes: Record<string, unknown>;
  status: { code: 0 | 1 | 2; message?: string };
}

const SPAN_SYMBOL = Symbol("otelSpan");

interface SpanContext {
  span: RecordedSpan;
  startTime: number;
}

function generateId(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function toIsoTimestamp(time: number): string {
  return new Date(time).toISOString();
}

class TraceRecorder {
  private spans: RecordedSpan[] = [];

  async record(span: RecordedSpan): Promise<void> {
    this.spans.push(span);
    await this.flush();
  }

  async flush(): Promise<void> {
    await fs.mkdir(path.dirname(TRACE_OUTPUT_PATH), { recursive: true });
    await fs.writeFile(TRACE_OUTPUT_PATH, JSON.stringify(this.spans, null, 2), "utf8");
  }
}

export interface TracingController {
  onRequest: (request: FastifyRequest) => void;
  onResponse: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  shutdown: () => Promise<void>;
}

export function setupTracing(serviceName: string, logger: FastifyBaseLogger): TracingController {
  const recorder = new TraceRecorder();
  logger.info({ traceOutput: TRACE_OUTPUT_PATH }, "otel tracing enabled");

  async function persistSpan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const context = (request as FastifyRequest & { [SPAN_SYMBOL]?: SpanContext })[SPAN_SYMBOL];
    if (!context) {
      return;
    }

    const route = request.routeOptions?.url ?? request.routerPath ?? request.raw.url;
    const endTime = Date.now();
    const durationMs = endTime - context.startTime;

    context.span.name = route ?? context.span.name;
    context.span.endTime = toIsoTimestamp(endTime);
    context.span.attributes = {
      ...context.span.attributes,
      "http.method": request.method,
      "http.target": request.raw.url,
      "http.route": route,
      "http.status_code": reply.statusCode,
      "fastify.route": route,
      "service.name": serviceName,
      "http.server_latency_ms": durationMs,
    };
    context.span.status = {
      code: reply.statusCode >= 400 ? 2 : 1,
    };

    await recorder.record(context.span);
    delete (request as FastifyRequest & { [SPAN_SYMBOL]?: SpanContext })[SPAN_SYMBOL];
  }

  return {
    onRequest: (request: FastifyRequest) => {
      const start = Date.now();
      const traceId = generateId(16);
      const spanId = generateId(8);
      const span: RecordedSpan = {
        traceId,
        spanId,
        parentSpanId: null,
        name: request.raw.url,
        kind: "SERVER",
        startTime: toIsoTimestamp(start),
        attributes: {},
        status: { code: 0 },
      };
      (request as FastifyRequest & { [SPAN_SYMBOL]?: SpanContext })[SPAN_SYMBOL] = {
        span,
        startTime: start,
      };
    },
    onResponse: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await persistSpan(request, reply);
      } catch (error) {
        logger.error({ err: error }, "failed to record otel span");
      }
    },
    shutdown: async () => {
      try {
        await recorder.flush();
      } catch (error) {
        logger.error({ err: error }, "failed to write otel spans on shutdown");
      }
    },
  };
}
