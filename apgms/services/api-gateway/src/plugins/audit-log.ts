import { createHash } from "node:crypto";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Writable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";

type Decision = "ALLOW" | "DENY" | "UNKNOWN";

type AuditBaseEvent = {
  ts: string;
};

type PolicyDecisionEvent = AuditBaseEvent & {
  type: "policy-decision";
  decision: "ALLOW" | "DENY";
  reason?: string;
  policy_id?: string;
};

type RptMintEvent = AuditBaseEvent & {
  type: "rpt-mint";
  rpt_id: string;
  policy_id?: string;
};

type AuditEvent = PolicyDecisionEvent | RptMintEvent;

type HashedAuditEvent = AuditEvent & {
  prev_hash: string;
  hash: string;
};

type AuditActor = {
  userId?: string;
  orgId?: string;
};

type AuditContext = {
  recordDecision: (
    decision: "ALLOW" | "DENY",
    opts?: { reason?: string; policyId?: string }
  ) => void;
  recordRptMint: (rptId: string, opts?: { policyId?: string }) => void;
  setActor: (actor: AuditActor) => void;
  decision?: Decision;
  reason?: string;
  getEvents: () => HashedAuditEvent[];
  getActor: () => AuditActor;
};

type Clock = () => Date;

type AuditLogPluginOptions = {
  stream?: Writable;
  clock?: Clock;
  outputPath?: string;
};

const ZERO_HASH = "0".repeat(64);
const DEFAULT_OUTPUT = resolve(process.cwd(), "artifacts/audit-sample.ndjson");
const startTimeSymbol = Symbol("auditStartTime");

const sanitizeValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = String(value);
  if (/^[^@]+@[^@]+\.[^@]+$/.test(text)) {
    return "[REDACTED]";
  }
  if (/\b\d{6,}\b/.test(text)) {
    return "[REDACTED]";
  }
  return text;
};

const sanitizeRoute = (route?: string): string => {
  if (!route) {
    return "unknown";
  }
  if (route.includes(":")) {
    return route;
  }
  return route
    .split("?")[0]
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (/^[a-zA-Z-]+$/.test(segment)) {
        return segment;
      }
      return ":param";
    })
    .join("/");
};

const ensureStream = (options?: AuditLogPluginOptions): Writable => {
  if (options?.stream) {
    return options.stream;
  }
  const outputPath = options?.outputPath ?? DEFAULT_OUTPUT;
  mkdirSync(dirname(outputPath), { recursive: true });
  return createWriteStream(outputPath, { flags: "a" });
};

const hashEvent = (event: AuditEvent, prevHash: string): HashedAuditEvent => {
  const base = { ...event };
  const hash = createHash("sha256")
    .update(prevHash)
    .update(JSON.stringify(base))
    .digest("hex");
  return { ...base, prev_hash: prevHash, hash };
};

const createAuditContext = (clock: Clock): AuditContext => {
  let lastHash = ZERO_HASH;
  const events: HashedAuditEvent[] = [];
  let decision: Decision | undefined;
  let reason: string | undefined;
  let actor: AuditActor = {};

  return {
    recordDecision: (nextDecision, opts) => {
      decision = nextDecision;
      reason = sanitizeValue(opts?.reason) ?? undefined;
      const event: PolicyDecisionEvent = {
        type: "policy-decision",
        decision: nextDecision,
        reason,
        policy_id: sanitizeValue(opts?.policyId),
        ts: clock().toISOString(),
      };
      const hashed = hashEvent(event, lastHash);
      lastHash = hashed.hash;
      events.push(hashed);
    },
    recordRptMint: (rptId, opts) => {
      const event: RptMintEvent = {
        type: "rpt-mint",
        rpt_id: sanitizeValue(rptId) ?? "[REDACTED]",
        policy_id: sanitizeValue(opts?.policyId),
        ts: clock().toISOString(),
      };
      const hashed = hashEvent(event, lastHash);
      lastHash = hashed.hash;
      events.push(hashed);
    },
    setActor: (nextActor) => {
      actor = {
        userId: sanitizeValue(nextActor.userId),
        orgId: sanitizeValue(nextActor.orgId),
      };
    },
    getEvents: () => [...events],
    getActor: () => ({ ...actor }),
    get decision() {
      return decision;
    },
    get reason() {
      return reason;
    },
  };
};

const auditLogPlugin: FastifyPluginAsync<AuditLogPluginOptions> = async (
  fastify,
  options
) => {
  const stream = ensureStream(options);
  const clock = options?.clock ?? (() => new Date());

  fastify.decorateRequest("audit", null);

  fastify.addHook("onRequest", async (request) => {
    const audit = createAuditContext(clock);
    request.audit = audit;
    (request as any)[startTimeSymbol] = process.hrtime.bigint();
    const userIdHeader = request.headers["x-user-id"];
    const orgIdHeader = request.headers["x-org-id"];
    if (userIdHeader || orgIdHeader) {
      audit.setActor({
        userId: userIdHeader as string | undefined,
        orgId: orgIdHeader as string | undefined,
      });
    }
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const endTime = process.hrtime.bigint();
    const startTime = (request as any)[startTimeSymbol] as bigint | undefined;
    const latencyMs = startTime
      ? Number((endTime - startTime) / BigInt(1_000_000))
      : undefined;

    const actor = request.audit?.getActor?.() ?? {};

    const resolvedDecision =
      request.audit?.decision ?? (reply.statusCode >= 400 ? "DENY" : "ALLOW");

    const payload = {
      ts: clock().toISOString(),
      req_id: request.id,
      user_id: actor.userId ?? sanitizeValue((request as any).user?.id),
      org_id: actor.orgId ?? sanitizeValue((request as any).user?.orgId),
      route: sanitizeRoute(
        request.routeOptions?.url ?? request.routerPath ?? request.raw.url
      ),
      status: reply.statusCode,
      latency_ms: latencyMs ?? null,
      decision: resolvedDecision,
      reason: request.audit?.reason ?? null,
      audit_blob: request.audit?.getEvents() ?? [],
    };

    await new Promise<void>((resolve, reject) => {
      stream.write(`${JSON.stringify(payload)}\n`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

declare module "fastify" {
  interface FastifyRequest {
    audit: AuditContext;
    [startTimeSymbol]?: bigint;
  }
}

export type { AuditLogPluginOptions, AuditContext, HashedAuditEvent };
(auditLogPlugin as any)[Symbol.for("skip-override")] = true;
(auditLogPlugin as any)[Symbol.for("fastify.display-name")] = "audit-log-plugin";
export default auditLogPlugin;
