import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

import { SpanKind } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ExportResult, ExportResultCode, SpanExporter } from "@opentelemetry/core";
import { ReadableSpan, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PgInstrumentation } from "opentelemetry-instrumentation-pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class JsonFileSpanExporter implements SpanExporter {
  private readonly buffer: ReadableSpan[] = [];

  constructor(private readonly filePath: string) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.buffer.push(...spans);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  async forceFlush(): Promise<void> {
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const spans = this.buffer.map((span) => ({
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: SpanKind[span.kind],
      startTime: span.startTime,
      endTime: span.endTime,
      attributes: span.attributes,
      status: span.status,
      resource: span.resource.attributes,
      events: span.events,
      links: span.links,
    }));

    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(spans, null, 2));
    this.buffer.length = 0;
  }
}

export async function startOtel(): Promise<NodeSDK> {
  const deploymentEnvironment = process.env.DEPLOYMENT_ENVIRONMENT ?? "development";
  const evidencePath = resolve(__dirname, "../../../../evidence/otel-run.json");

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "api-gateway",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: deploymentEnvironment,
    }),
    instrumentations: [
      new PgInstrumentation(),
    ],
  });

  sdk.addSpanProcessor(new SimpleSpanProcessor(new JsonFileSpanExporter(evidencePath)));

  await sdk.start();

  const shutdown = async () => {
    await sdk.shutdown().catch(() => undefined);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return sdk;
}
