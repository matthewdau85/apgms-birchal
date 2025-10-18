import fp from "fastify-plugin";
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
} from "fastify";
import type { Span } from "@opentelemetry/api";
import { ulid } from "ulid";
import { runWithSpan, startAllocationsSpan, startRptVerifySpan } from "../otel";

const securityEventNames = [
  "auth_denied",
  "idempotency_replay",
  "webhook_replay",
  "rpt_verify_fail",
] as const;

type SecurityEvent = (typeof securityEventNames)[number];

const securityEventSet = new Set<SecurityEvent>(securityEventNames);

type SecurityLogger = (event: SecurityEvent, details?: Record<string, unknown>) => Promise<void>;
type RequestSecurityLogger = (
  event: SecurityEvent,
  details?: Record<string, unknown>,
) => Promise<void>;
type AllocationsSpanRunner = <T>(operation: string, fn: (span: Span | null) => Promise<T>) => Promise<T>;
type RptSpanRunner = <T>(fn: (span: Span | null) => Promise<T>) => Promise<T>;

declare module "fastify" {
  interface FastifyInstance {
    logSecurityEvent: SecurityLogger;
  }

  interface FastifyRequest {
    requestStartTime?: bigint;
    logSecurityEvent: RequestSecurityLogger;
    withAllocationsSpan: AllocationsSpanRunner;
    withRptVerifySpan: RptSpanRunner;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function resolveOrgId(request: FastifyRequest): string | undefined {
  const header = headerValue(request.headers["x-org-id"] as string | string[] | undefined);
  if (header) {
    return header;
  }
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body.orgId === "string") {
    return body.orgId;
  }
  const params = request.params as Record<string, unknown> | undefined;
  if (params && typeof params.orgId === "string") {
    return params.orgId;
  }
  return undefined;
}

function resolveUserId(request: FastifyRequest): string | undefined {
  const header = headerValue(request.headers["x-user-id"] as string | string[] | undefined);
  if (header) {
    return header;
  }
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body.userId === "string") {
    return body.userId;
  }
  return undefined;
}

function resolveRoutePath(request: FastifyRequest): string {
  const candidate = (request as { routerPath?: string }).routerPath;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  const optionUrl = request.routeOptions?.url;
  return (typeof optionUrl === "string" && optionUrl.length > 0) ? optionUrl : request.url;
}

const loggingPlugin: FastifyPluginAsync = fp(async (fastify: FastifyInstance): Promise<void> => {
  fastify.decorate("logSecurityEvent", async (event: SecurityEvent, details: Record<string, unknown> = {}) => {
    if (!securityEventSet.has(event)) {
      fastify.log.warn({ type: "security_event_invalid", event, details }, "invalid security event");
      return;
    }

    if (event === "rpt_verify_fail") {
      await runWithSpan(startRptVerifySpan(), async (span) => {
        if (span) {
          span.setAttributes({
            "security.event": event,
            ...(typeof details.reason === "string" && { "security.reason": details.reason }),
            ...(typeof details.orgId === "string" && { "security.org_id": details.orgId }),
            ...(typeof details.userId === "string" && { "security.user_id": details.userId }),
          });
        }
        return;
      });
    }

    fastify.log.warn({ type: "security_event", event, ...details });
  });

  fastify.decorateRequest(
    "logSecurityEvent",
    async function logSecurityEvent(
      this: FastifyRequest,
      event: SecurityEvent,
      details: Record<string, unknown> = {},
    ) {
      const base = {
        req_id: this.id,
        route: resolveRoutePath(this),
        orgId: resolveOrgId(this),
        userId: resolveUserId(this),
      } satisfies Record<string, unknown>;
      await fastify.logSecurityEvent(event, { ...base, ...details });
    },
  );

  const withAllocationsSpan = async function withAllocationsSpan<T>(
    this: FastifyRequest,
    operation: string,
    fn: (span: Span | null) => Promise<T>,
  ): Promise<T> {
    return runWithSpan(startAllocationsSpan(operation), (span) => fn(span));
  };

  const withRptVerifySpan = async function withRptVerifySpan<T>(
    this: FastifyRequest,
    fn: (span: Span | null) => Promise<T>,
  ): Promise<T> {
    return runWithSpan(startRptVerifySpan(), (span) => fn(span));
  };

  fastify.decorateRequest("withAllocationsSpan", withAllocationsSpan);
  fastify.decorateRequest("withRptVerifySpan", withRptVerifySpan);

  fastify.addHook("onRoute", (routeOptions: any) => {
    if (!routeOptions.url || !routeOptions.url.startsWith("/allocations/")) {
      return;
    }
    if (typeof routeOptions.handler !== "function") {
      return;
    }

    const originalHandler = routeOptions.handler as RouteHandlerMethod;
    routeOptions.handler = async function (request: FastifyRequest, reply: FastifyReply) {
      const rawOperation = routeOptions.url.replace(/^\/allocations\/?/, "");
      const operation = rawOperation.length > 0 ? rawOperation.replace(/\//g, ".") : "route";
      return runWithSpan(startAllocationsSpan(operation), async (span) => {
        if (span) {
          span.setAttributes({
            "allocations.operation": operation,
            "http.route": routeOptions.url,
            "http.method": request.method,
          });
        }
        const result = await originalHandler.call(this, request, reply);
        if (span) {
          span.setAttribute("http.status_code", reply.statusCode);
        }
        return result;
      });
    };
  });

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const reqId = ulid();
    request.id = reqId;
    reply.header("x-request-id", reqId);
    request.requestStartTime = process.hrtime.bigint();
    (request as any).log = request.log.child({ req_id: reqId });
  });

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const finishedAt = process.hrtime.bigint();
    const durationMs =
      request.requestStartTime !== undefined
        ? Number((finishedAt - request.requestStartTime) / BigInt(1_000_000))
        : 0;
    const route = resolveRoutePath(request);
    const logPayload = {
      event: "request_completed",
      req_id: request.id,
      method: request.method,
      route,
      status: reply.statusCode,
      duration_ms: durationMs,
      orgId: resolveOrgId(request) ?? null,
      userId: resolveUserId(request) ?? null,
    } satisfies Record<string, unknown>;
    request.log.info(logPayload);
  });

  fastify.addHook("onError", async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    request.log.error(
      {
        event: "request_error",
        req_id: request.id,
        method: request.method,
        route: resolveRoutePath(request),
        status: reply.statusCode ?? 500,
        orgId: resolveOrgId(request) ?? null,
        userId: resolveUserId(request) ?? null,
      },
      error,
    );
  });
});

export default loggingPlugin;
