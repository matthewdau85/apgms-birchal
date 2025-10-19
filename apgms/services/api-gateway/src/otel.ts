import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import {
  ExportResultCode,
  ReadableSpan,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { promises as fs } from "node:fs";
import path from "node:path";

class JsonFileSpanExporter implements SpanExporter {
  private readonly spans: unknown[] = [];
  constructor(private readonly filePath: string) {}

  export(spans: ReadableSpan[], resultCallback: (result: { code: ExportResultCode; error?: Error }) => void): void {
    try {
      const serialized = spans.map((span) => ({
        spanContext: span.spanContext(),
        parentSpanId: span.parentSpanId,
        name: span.name,
        kind: span.kind,
        startTime: span.startTime,
        endTime: span.endTime,
        status: span.status,
        attributes: span.attributes,
        events: span.events,
        links: span.links,
        resource: span.resource.attributes,
        instrumentationScope: span.instrumentationScope,
      }));
      this.spans.push(...serialized);
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      resultCallback({ code: ExportResultCode.FAILED, error: error as Error });
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  async forceFlush(): Promise<void> {
    await this.flush();
  }

  private async flush(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(
        {
          resourceSpans: this.spans,
        },
        null,
        2,
      ),
      "utf-8",
    );
  }
}

const outputPath = path.resolve(process.cwd(), "otel-traces.json");
const exporter = new JsonFileSpanExporter(outputPath);

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const sdk = new NodeSDK({
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

let started = false;

export const initOtel = async (): Promise<void> => {
  if (started) {
    return;
  }
  started = true;
  await sdk.start();

  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch (error) {
      diag.error("Failed to shutdown OpenTelemetry SDK", error as Error);
    }
  };

  process.once("beforeExit", shutdown);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};
