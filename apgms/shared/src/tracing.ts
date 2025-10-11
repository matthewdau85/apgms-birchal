import { diag, DiagConsoleLogger, DiagLogLevel, propagation, context, type Context, type Tracer } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";
import { SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

let provider: NodeTracerProvider | undefined;
const tracerCache = new Map<string, Tracer>();
let diagnosticsConfigured = false;

export function setupTracing(serviceName: string): Tracer {
  if (tracerCache.has(serviceName)) {
    return tracerCache.get(serviceName)!;
  }

  if (!diagnosticsConfigured) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
    diagnosticsConfigured = true;
  }

  if (!provider) {
    provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

    provider.register({
      propagator: new W3CTraceContextPropagator(),
    });
  }

  const tracer = provider.getTracer(serviceName);
  tracerCache.set(serviceName, tracer);
  return tracer;
}

export function extractContextFromHeaders(headers: Record<string, unknown>): Context {
  return propagation.extract(context.active(), headers);
}

export function injectContextToHeaders(ctx: Context): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(ctx, carrier);
  return carrier;
}
