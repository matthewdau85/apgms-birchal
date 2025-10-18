import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeSDK, ExportResultCode } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

type SpanContext = {
  traceId: string;
  spanId: string;
};

type SpanLike = {
  spanContext: () => SpanContext;
  parentSpanId?: string;
  name: string;
  kind: unknown;
  startTime?: [number, number];
  endTime?: [number, number];
  duration?: [number, number];
  status?: unknown;
  attributes?: Record<string, unknown>;
  resource?: { attributes?: Record<string, unknown> };
  instrumentationLibrary?: Record<string, unknown>;
  events?: unknown[];
  links?: unknown[];
};

type ExportResult = { code: number };

interface SpanExporter {
  export(spans: SpanLike[], resultCallback: (result: ExportResult) => void): void;
  shutdown(): Promise<void>;
}

class FileSpanExporter implements SpanExporter {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  export(spans: SpanLike[], resultCallback: (result: ExportResult) => void): void {
    if (spans.length === 0) {
      setImmediate(() => resultCallback({ code: ExportResultCode.SUCCESS }));
      return;
    }

    const payload = spans
      .map((span) => JSON.stringify(this.formatSpan(span)))
      .join("\n")
      .concat("\n");

    fs.promises
      .appendFile(this.filePath, payload)
      .then(() => {
        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch((error) => {
        console.error("Failed to write OTEL spans", error);
        resultCallback({ code: ExportResultCode.FAILED });
      });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  private formatSpan(span: SpanLike) {
    return {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,
      kind: span.kind,
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.duration,
      status: span.status,
      attributes: span.attributes ?? {},
      resource: span.resource?.attributes ?? {},
      instrumentationLibrary: span.instrumentationLibrary,
      events: span.events ?? [],
      links: span.links ?? [],
    };
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const traceOutputPath = path.resolve(repoRoot, "reports", "otel-traces.ndjson");

export function enableOtelIfRequested() {
  if (process.env.OTEL_ENABLE !== "1") {
    return {
      async start() {},
      async shutdown() {},
    };
  }

  const exporter = new FileSpanExporter(traceOutputPath);
  const sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: getNodeAutoInstrumentations(),
  });

  let started = false;

  return {
    async start() {
      if (started) {
        return;
      }
      fs.rmSync(traceOutputPath, { force: true });
      await sdk.start();
      started = true;
    },
    async shutdown() {
      if (!started) {
        return;
      }
      started = false;
      await sdk.shutdown();
    },
  };
}
