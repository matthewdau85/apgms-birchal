import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type RequestSpan = {
  traceId: string;
  spanId: string;
  name: string;
  timestamp: number;
  startTime: bigint;
  attributes: Record<string, unknown>;
};

const serviceName = process.env.OTEL_SERVICE_NAME ?? "api-gateway";
const exporter = process.env.OTEL_EXPORTER;
const tracingEnabled = exporter === "console";

const ORG_KEYS = ["orgId", "orgID", "organisationId", "organizationId"];

const generateTraceId = () => crypto.randomBytes(16).toString("hex");
const generateSpanId = () => crypto.randomBytes(8).toString("hex");

function extractOrgId(request: FastifyRequest): string | undefined {
  const fromHeaders = request.headers["x-org-id"] ?? request.headers["orgid"];
  if (typeof fromHeaders === "string" && fromHeaders.length > 0) {
    const trimmed = fromHeaders.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  const sources: Array<unknown> = [request.body, request.params, request.query];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const key of ORG_KEYS) {
      const candidate = (source as Record<string, unknown>)[key];
      if (candidate !== undefined && candidate !== null) {
        const value = String(candidate).trim();
        if (value.length > 0) {
          return value;
        }
      }
    }
  }

  return undefined;
}

function baseAttributes(request: FastifyRequest) {
  const route = request.routeOptions?.url ?? request.url;

  const attributes: Record<string, unknown> = {
    "http.method": request.method,
    "http.route": route,
    "http.target": request.url,
    "net.host.name": request.hostname,
  };

  return attributes;
}

function finaliseSpan(span: RequestSpan, reply: FastifyReply, request: FastifyRequest) {
  const end = process.hrtime.bigint();
  const duration = end - span.startTime;
  const statusCode = reply.statusCode;

  const attributes: Record<string, unknown> = {
    ...span.attributes,
    "http.status_code": statusCode,
    "http.response.status_code": statusCode,
  };

  const orgId = extractOrgId(request);
  if (orgId) {
    attributes["apgms.org_id"] = orgId;
  }

  const statusCodeCategory = statusCode >= 400 ? 2 : 1;

  const otelSpan = {
    traceId: span.traceId,
    parentId: undefined,
    name: span.name,
    id: span.spanId,
    kind: 1, // SERVER
    timestamp: span.timestamp,
    duration: Number(duration / 1000n), // microseconds
    attributes,
    status: {
      code: statusCodeCategory,
    },
    events: [] as unknown[],
    links: [] as unknown[],
    resource: {
      attributes: {
        "service.name": serviceName,
        "telemetry.sdk.language": "nodejs",
        "telemetry.sdk.name": "custom",
        "telemetry.sdk.version": "0.1.0",
      },
    },
    instrumentationLibrary: {
      name: "apgms.fastify.manual",
      version: "0.1.0",
    },
  };

  console.log("OTEL span", otelSpan);
}

export function setupTracing(app: FastifyInstance) {
  if (!tracingEnabled) {
    return;
  }

  app.addHook("onRequest", (request, _reply, done) => {
    const span: RequestSpan = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      name: `${request.method} ${(request.routeOptions?.url ?? request.url) as string}`,
      timestamp: Math.floor(Date.now() * 1000),
      startTime: process.hrtime.bigint(),
      attributes: baseAttributes(request),
    };

    (request as FastifyRequest & { __otelSpan?: RequestSpan }).__otelSpan = span;
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const span = (request as FastifyRequest & { __otelSpan?: RequestSpan }).__otelSpan;
    if (span) {
      finaliseSpan(span, reply, request);
    }
    done();
  });
}

export const isTracingEnabled = tracingEnabled;
