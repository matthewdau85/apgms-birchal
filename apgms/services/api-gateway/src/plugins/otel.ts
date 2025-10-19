import type { FastifyPluginAsync } from "fastify";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PrismaInstrumentation } from "@prisma/instrumentation";

let sdk: NodeSDK | undefined;

const otelPlugin: FastifyPluginAsync = async (fastify) => {
  if (process.env.NODE_ENV === "test" || process.env.OTEL_DISABLED === "1") {
    return;
  }

  if (!sdk) {
    sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]:
          process.env.OTEL_SERVICE_NAME ?? "api-gateway",
      }),
      instrumentations: [
        new HttpInstrumentation(),
        new FastifyInstrumentation(),
        new PrismaInstrumentation(),
      ],
    });

    try {
      await sdk.start();
      fastify.log.info("OpenTelemetry SDK started");
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to start OpenTelemetry SDK");
    }
  }

  fastify.addHook("onClose", async () => {
    if (sdk) {
      await sdk.shutdown();
      sdk = undefined;
    }
  });
};

export default otelPlugin;
