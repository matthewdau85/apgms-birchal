import type { FastifyContextConfig, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const defaultRedactPaths = ["body.password", "body.card", "body.cardNumber", "body.ssn"] as const;

const START_TIME = Symbol("auditStartTime");

type Decision = "ALLOW" | "DENY";

export interface AuditLogPluginOptions {
  redactPaths?: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id?: string | null;
      orgId?: string | null;
    } | null;
    audit?: {
      decision?: Decision;
      reason?: string;
    } | null;
    [START_TIME]?: bigint;
  }

  interface FastifyContextConfig {
    audit?: {
      protected?: boolean;
      enabled?: boolean;
    };
  }
}

const getLatencyMs = (start?: bigint) => {
  if (!start) return 0;
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1_000_000;
};

const determineDecision = (request: FastifyRequest, reply: FastifyReply): {
  decision: Decision;
  reason?: string;
} => {
  const status = reply.statusCode;
  const defaultDecision: Decision = status >= 400 ? "DENY" : "ALLOW";
  const defaultReason = status >= 400 ? `status_${status}` : undefined;
  const decision = request.audit?.decision ?? defaultDecision;
  const reason = request.audit?.reason ?? defaultReason;
  return { decision, reason };
};

const shouldAudit = (request: FastifyRequest) => {
  const config = (request.routeOptions.config as FastifyContextConfig | undefined)?.audit;
  if (!config) return false;
  if (config.enabled !== undefined) return config.enabled;
  return config.protected === true;
};

const setupAuditLogger = (app: FastifyInstance, paths?: string[]) =>
  app.log.child(
    { component: "audit" },
    {
      redact: {
        paths: paths ?? [...defaultRedactPaths],
        remove: true,
      },
    },
  );

const auditPlugin = async (app: FastifyInstance, opts: AuditLogPluginOptions = {}) => {
  const auditLogger = setupAuditLogger(app, opts.redactPaths);

  app.addHook("onRequest", async (request) => {
    request[START_TIME] = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (request, reply) => {
    if (!shouldAudit(request)) {
      return;
    }

    const { decision, reason } = determineDecision(request, reply);

    const userAgentHeader = request.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader[0]
      : userAgentHeader ?? "";

    const payload = {
      ts: new Date().toISOString(),
      req_id: request.id,
      user_id: request.user?.id ?? null,
      org_id: request.user?.orgId ?? null,
      route: request.routeOptions.url ?? request.routerPath ?? request.raw.url ?? "",
      method: request.method,
      status: reply.statusCode,
      latency_ms: getLatencyMs(request[START_TIME]),
      decision,
      ...(reason ? { reason } : {}),
      ip: request.ip,
      user_agent: userAgent,
      body: request.body ?? null,
    };

    auditLogger.info(payload, "audit");
  });
};

export default auditPlugin;
