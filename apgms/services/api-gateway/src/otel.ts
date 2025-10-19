import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

type AttributeValue = string | number | boolean;

type SpanRecord = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, AttributeValue>;
  status: {
    code: number;
    message?: string;
  };
};

type SpanHandle = {
  record: SpanRecord;
  startHrTime: bigint;
};

const activeSpans = new Set<SpanHandle>();
const completedSpans: SpanRecord[] = [];

const SERVICE_NAME = "api-gateway";
const SPAN_KIND_SERVER = 2;
const STATUS_CODE_OK = 1;
const STATUS_CODE_ERROR = 2;

const toUnixNano = (date: Date) => (BigInt(date.getTime()) * 1_000_000n).toString();

const randomHex = (bytes: number) => randomBytes(bytes).toString("hex");

export function startHttpSpan(name: string, attributes: Record<string, AttributeValue> = {}): SpanHandle {
  const start = new Date();
  const handle: SpanHandle = {
    record: {
      traceId: randomHex(16),
      spanId: randomHex(8),
      parentSpanId: null,
      name,
      kind: SPAN_KIND_SERVER,
      startTimeUnixNano: toUnixNano(start),
      endTimeUnixNano: toUnixNano(start),
      attributes: { ...attributes },
      status: { code: STATUS_CODE_OK },
    },
    startHrTime: process.hrtime.bigint(),
  };

  activeSpans.add(handle);
  return handle;
}

export function finishHttpSpan(
  handle: SpanHandle,
  statusCode: number,
  extraAttributes: Record<string, AttributeValue> = {},
  statusMessage?: string,
): void {
  if (!activeSpans.has(handle)) {
    return;
  }

  activeSpans.delete(handle);

  const durationNs = process.hrtime.bigint() - handle.startHrTime;
  const startTime = BigInt(handle.record.startTimeUnixNano);
  handle.record.endTimeUnixNano = (startTime + durationNs).toString();
  handle.record.attributes = {
    ...handle.record.attributes,
    ...extraAttributes,
    "http.status_code": statusCode,
  };

  handle.record.status = {
    code: statusCode >= 500 ? STATUS_CODE_ERROR : STATUS_CODE_OK,
    message: statusMessage,
  };

  if (!statusMessage) {
    delete handle.record.status.message;
  }

  completedSpans.push(handle.record);
}

const attributeValue = (value: AttributeValue) => {
  if (typeof value === "number") {
    return { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  return { stringValue: String(value) };
};

const toOtelPayload = () => ({
  resourceSpans: [
    {
      resource: {
        attributes: [
          {
            key: "service.name",
            value: { stringValue: SERVICE_NAME },
          },
        ],
      },
      scopeSpans: [
        {
          scope: { name: "manual-http" },
          spans: completedSpans.map((span) => ({
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId ?? undefined,
            name: span.name,
            kind: span.kind,
            startTimeUnixNano: span.startTimeUnixNano,
            endTimeUnixNano: span.endTimeUnixNano,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              value: attributeValue(value),
            })),
            status: span.status,
          })),
        },
      ],
    },
  ],
});

const writeSpansIfRequested = async () => {
  if (!process.env.OTEL_DUMP || completedSpans.length === 0) {
    return;
  }

  const artifactsDir = path.resolve(process.cwd(), "artifacts");
  await fs.promises.mkdir(artifactsDir, { recursive: true });
  const filePath = path.join(artifactsDir, "otel-http.json");
  const payload = toOtelPayload();
  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2));
};

process.on("beforeExit", () => {
  void writeSpansIfRequested();
});
