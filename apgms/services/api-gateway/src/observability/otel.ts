import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const evidenceDir = path.resolve(__dirname, "../../../..", "evidence");
const evidenceFile = path.join(evidenceDir, "otel-run.json");

interface Instrumentation {
  enable(): void;
  disable(): void;
}

interface SpanRecord {
  traceId: string;
  spanId: string;
  instrumentation: string;
  name: string;
  attributes: Record<string, unknown>;
  status: "OK" | "ERROR";
  startTime: string;
  durationMs: number;
  errorMessage?: string;
}

class JsonFileSpanExporter {
  private spans: (SpanRecord & { serviceName: string })[] = [];

  constructor(private readonly filePath: string, private readonly serviceName: string) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, "[]\n", "utf8");
  }

  record(span: SpanRecord) {
    const enriched = { ...span, serviceName: this.serviceName };
    this.spans.push(enriched);
    fs.writeFileSync(this.filePath, JSON.stringify(this.spans, null, 2) + "\n", "utf8");
  }

  async shutdown() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.spans, null, 2) + "\n", "utf8");
  }
}

class PrismaPgInstrumentation implements Instrumentation {
  private enabled = false;
  private registered = false;

  constructor(private readonly prisma: PrismaClient, private readonly exporter: JsonFileSpanExporter) {}

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    if (this.registered) return;
    this.registered = true;

    this.prisma.$use(async (params, next) => {
      const startTimeMs = Date.now();
      let status: "OK" | "ERROR" = "OK";
      let errorMessage: string | undefined;

      try {
        const result = await next(params);
        return result;
      } catch (err) {
        status = "ERROR";
        errorMessage = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        if (!this.enabled) {
          return;
        }

        const endTimeMs = Date.now();
        const durationMs = endTimeMs - startTimeMs;

        const span: SpanRecord = {
          traceId: randomUUID().replace(/-/g, ""),
          spanId: randomUUID().replace(/-/g, "").slice(0, 16),
          instrumentation: "prisma-pg",
          name: `${params.model ?? "prisma"}.${params.action}`,
          attributes: {
            action: params.action,
            model: params.model ?? "unknown",
            target: params.args ? Object.keys(params.args).join(",") : "",
          },
          status,
          startTime: new Date(startTimeMs).toISOString(),
          durationMs,
          errorMessage,
        };

        this.exporter.record(span);
      }
    });
  }

  disable(): void {
    this.enabled = false;
  }
}

class NodeSDK {
  private started = false;

  constructor(
    private readonly options: {
      instrumentations: Instrumentation[];
      traceExporter: JsonFileSpanExporter;
    },
  ) {}

  async start() {
    if (this.started) return;
    this.started = true;
    for (const instrumentation of this.options.instrumentations) {
      instrumentation.enable();
    }
  }

  async shutdown() {
    if (!this.started) return;
    for (const instrumentation of this.options.instrumentations) {
      instrumentation.disable();
    }
    await this.options.traceExporter.shutdown();
    this.started = false;
  }
}

let sdk: NodeSDK | null = null;

export function initObservability(prisma: PrismaClient) {
  if (sdk) {
    return sdk;
  }

  const exporter = new JsonFileSpanExporter(evidenceFile, "api-gateway");
  const instrumentation = new PrismaPgInstrumentation(prisma, exporter);
  sdk = new NodeSDK({ instrumentations: [instrumentation], traceExporter: exporter });

  sdk
    .start()
    .catch((err) => {
      console.error("Failed to start observability SDK", err);
    });

  const shutdown = () => {
    sdk
      ?.shutdown()
      .catch((err) => {
        console.error("Failed to shutdown observability SDK", err);
      });
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  process.once("beforeExit", shutdown);

  return sdk;
}

export function getEvidenceFilePath() {
  return evidenceFile;
}
