import { context, Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PrismaInstrumentation } from "@prisma/instrumentation";

let sdk: NodeSDK | null = null;
let telemetryEnabled = false;

export const tracer = trace.getTracer("api-gateway");

type FastifyRequestHookInfo = {
  request: {
    routeOptions?: { url?: string };
    url: string;
    method: string;
  };
};

export interface TelemetryController {
  shutdown(): Promise<void>;
}

function buildEndpoint(base: string, suffix: string): string {
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}${suffix}`;
}

export async function startTelemetry(endpoint: string | null): Promise<TelemetryController> {
  if (!endpoint) {
    telemetryEnabled = false;
    return {
      shutdown: async () => {
        /* noop */
      },
    };
  }

  if (sdk) {
    telemetryEnabled = true;
    return {
      shutdown: async () => {
        telemetryEnabled = false;
        if (sdk) {
          await sdk.shutdown();
          sdk = null;
        }
      },
    };
  }

  const traceExporter = new OTLPTraceExporter({
    url: buildEndpoint(endpoint, "/v1/traces"),
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: buildEndpoint(endpoint, "/v1/metrics"),
    }),
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "api-gateway",
    }),
    traceExporter,
    metricReader,
    instrumentations: [
      new FastifyInstrumentation({
        requestHook: (span: Span, info: FastifyRequestHookInfo) => {
          const route = info.request.routeOptions?.url ?? info.request.url;
          span.setAttributes({
            "http.route": route,
            "http.method": info.request.method,
          });
        },
      }),
      new PrismaInstrumentation(),
    ],
  });

  await sdk.start();
  telemetryEnabled = true;

  return {
    shutdown: async () => {
      telemetryEnabled = false;
      if (sdk) {
        await sdk.shutdown();
        sdk = null;
      }
    },
  };
}

export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, unknown>,
): Promise<T> {
  if (!telemetryEnabled) {
    const noopSpan = trace.getTracer("noop").startSpan(name);
    try {
      if (attributes) {
        noopSpan.setAttributes(attributes);
      }
      return await fn(noopSpan);
    } finally {
      noopSpan.end();
    }
  }

  return tracer.startActiveSpan(name, async (span: Span) => {
    try {
      if (attributes) {
        span.setAttributes(attributes);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function startChildSpan(name: string, attributes?: Record<string, unknown>): Span | null {
  if (!telemetryEnabled) {
    return null;
  }
  const parentContext = context.active();
  const span = tracer.startSpan(name, { attributes }, parentContext);
  return span;
}

export function runWithSpan<T>(span: Span | null, fn: (span: Span | null) => Promise<T>): Promise<T> {
  if (!telemetryEnabled || !span) {
    return fn(span);
  }
  const spanContext = trace.setSpan(context.active(), span);
  return context.with(spanContext, async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function startAllocationsSpan(operation: string): Span | null {
  return startChildSpan(`allocations.${operation}`);
}

export function startRptVerifySpan(): Span | null {
  return startChildSpan("rpt.verify");
}
