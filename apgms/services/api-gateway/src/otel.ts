import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PrismaInstrumentation } from "@prisma/instrumentation";

let sdk: NodeSDK | undefined;

const serviceName = process.env.OTEL_SERVICE_NAME ?? "api-gateway";

export const startOtel = async () => {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return undefined;
  }

  if (sdk) {
    return sdk;
  }

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    instrumentations: [
      new FastifyInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  await sdk.start();
  return sdk;
};

export const shutdownOtel = async () => {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = undefined;
};
