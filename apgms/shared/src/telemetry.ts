import { context, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import type { Logger } from "./logger";

export interface TelemetryConfig {
  serviceName: string;
  otlpEndpoint?: string;
}

export type TelemetrySDK = NodeSDK;

export async function startTelemetry(
  config: TelemetryConfig,
  logger?: Logger,
): Promise<TelemetrySDK | undefined> {
  const endpoint = config.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    logger?.debug({ service: config.serviceName }, "telemetry disabled");
    return undefined;
  }

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    await sdk.start();
    logger?.info({ endpoint }, "telemetry started");
    return sdk;
  } catch (err) {
    logger?.error({ err }, "failed to start telemetry");
    return undefined;
  }
}

export async function shutdownTelemetry(sdk: TelemetrySDK | undefined, logger?: Logger): Promise<void> {
  if (!sdk) {
    return;
  }
  try {
    await sdk.shutdown();
    logger?.info("telemetry stopped");
  } catch (err) {
    logger?.error({ err }, "failed to shutdown telemetry");
  }
}

export interface TraceContext {
  traceId: string;
  spanId: string;
}

export function getActiveTraceContext(): TraceContext | undefined {
  const span = trace.getSpan(context.active());
  if (!span) {
    return undefined;
  }
  const spanContext = span.spanContext();
  if (!spanContext || !spanContext.traceId || !spanContext.spanId) {
    return undefined;
  }
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}
