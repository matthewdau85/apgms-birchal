import fs from "node:fs/promises";
import path from "node:path";
import { trace, SpanKind } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import type { ExportResult } from "@opentelemetry/core";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const serviceName = "api-gateway";

let sdk: NodeSDK | undefined;
let starting: Promise<void> | undefined;
let shutdownHooksBound = false;
const shutdownListeners: Array<[NodeJS.Signals | "beforeExit", () => void]> = [];

class JsonFileSpanExporter implements SpanExporter {
  private spans: ReadableSpan[] = [];

  constructor(private readonly filePath: string) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.spans.push(...spans);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  async forceFlush(): Promise<void> {
    await this.flush();
  }

  private async flush(): Promise<void> {
    const normalized = this.spans.map((span) => ({
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,
      kind: SpanKind[span.kind],
      startTime: span.startTime,
      endTime: span.endTime,
      durationMs: span.duration[0] * 1_000 + span.duration[1] / 1_000_000,
      attributes: span.attributes,
      status: span.status,
    }));

    const output = JSON.stringify({ resource: serviceName, spans: normalized }, null, 2);
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(this.filePath, output, "utf8");
  }
}

const createTraceExporter = (): SpanExporter | undefined => {
  const filePath = process.env.OTEL_TRACE_FILE;
  if (!filePath) {
    return undefined;
  }
  return new JsonFileSpanExporter(path.resolve(filePath));
};

const bindShutdownHooks = () => {
  if (shutdownHooksBound) {
    return;
  }

  const handler = () => {
    void shutdownOtel();
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const listener = () => handler();
    shutdownListeners.push([signal, listener]);
    process.once(signal, listener);
  }

  const beforeExitListener = () => handler();
  shutdownListeners.push(["beforeExit", beforeExitListener]);
  process.once("beforeExit", beforeExitListener);

  shutdownHooksBound = true;
};

const clearShutdownHooks = () => {
  if (!shutdownHooksBound) {
    return;
  }

  for (const [event, listener] of shutdownListeners) {
    process.off(event, listener as () => void);
  }
  shutdownListeners.length = 0;
  shutdownHooksBound = false;
};

export const tracer = trace.getTracer(`services-${serviceName}`);

export const startOtel = async (): Promise<void> => {
  if (process.env.OTEL_ENABLED !== "true") {
    return;
  }

  if (sdk) {
    return;
  }

  if (starting) {
    await starting;
    return;
  }

  const traceExporter = createTraceExporter();

  const configuration = {
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    instrumentations: getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-http": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-fastify": {
        enabled: true,
      },
    }),
  } as const;

  const nodeSdk = new NodeSDK(
    traceExporter
      ? {
          ...configuration,
          traceExporter,
        }
      : configuration,
  );

  sdk = nodeSdk;
  starting = nodeSdk
    .start()
    .then(() => {
      bindShutdownHooks();
    })
    .catch((error) => {
      sdk = undefined;
      throw error;
    });

  await starting;
  starting = undefined;
};

export const forceFlushOtel = async (): Promise<void> => {
  if (!sdk) {
    return;
  }
  await sdk.forceFlush();
};

export const shutdownOtel = async (): Promise<void> => {
  if (!sdk) {
    return;
  }

  const activeSdk = sdk;
  sdk = undefined;
  starting = undefined;

  try {
    await activeSdk.shutdown();
  } finally {
    clearShutdownHooks();
  }
};
