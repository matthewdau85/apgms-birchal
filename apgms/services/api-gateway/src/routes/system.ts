import net from "node:net";
import type { FastifyInstance } from "fastify";

const SERVICE_NAME = "api-gateway";

type ComponentStatus = "pass" | "fail";

type ComponentCheck = {
  status: ComponentStatus;
  latencyMs: number;
  checkedAt: string;
  error?: string;
};

type HealthChecks = {
  database: ComponentCheck;
  redis: ComponentCheck;
};

type RouteOptions = {
  prisma: { $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> };
  redisUrl?: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function runCheck(check: () => Promise<void>): Promise<Omit<ComponentCheck, "checkedAt">> {
  const start = process.hrtime.bigint();
  try {
    await check();
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    return { status: "pass", latencyMs };
  } catch (error) {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const message = error instanceof Error ? error.message : "Unknown error";
    return { status: "fail", latencyMs, error: message };
  }
}

async function checkDatabase(prisma: RouteOptions["prisma"]): Promise<ComponentCheck> {
  const result = await runCheck(() => prisma.$queryRaw`SELECT 1`);
  return { ...result, checkedAt: nowIso() };
}

async function checkRedis(redisUrl: string | undefined): Promise<ComponentCheck> {
  const start = process.hrtime.bigint();
  const buildResult = (status: ComponentStatus, error?: string): ComponentCheck => {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    return {
      status,
      latencyMs,
      checkedAt: nowIso(),
      ...(error ? { error } : {}),
    };
  };

  if (!redisUrl) {
    return buildResult("fail", "missing redis url");
  }

  let parsed: URL;
  try {
    parsed = new URL(redisUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid redis url";
    return buildResult("fail", message);
  }

  const host = parsed.hostname;
  const port = Number(parsed.port || 6379);
  if (!host || Number.isNaN(port)) {
    return buildResult("fail", "invalid redis address");
  }

  return new Promise<ComponentCheck>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finalize = (status: ComponentStatus, error?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.removeAllListeners();
      if (!socket.destroyed) {
        socket.destroy();
      }
      resolve(buildResult(status, error));
    };

    socket.once("connect", () => finalize("pass"));
    socket.once("error", (err) => finalize("fail", err.message));
    socket.setTimeout(1_000, () => finalize("fail", "redis connection timed out"));
  });
}

function deriveOverallStatus(checks: HealthChecks): "ok" | "degraded" {
  const { database, redis } = checks;
  return database.status === "pass" && redis.status === "pass" ? "ok" : "degraded";
}

function deriveReadyStatus(checks: HealthChecks): {
  status: "ready" | "not_ready";
  httpCode: 200 | 503;
} {
  const healthy = checks.database.status === "pass" && checks.redis.status === "pass";
  return healthy ? { status: "ready", httpCode: 200 } : { status: "not_ready", httpCode: 503 };
}

export function registerSystemRoutes(app: FastifyInstance, options: RouteOptions) {
  const { prisma, redisUrl } = options;

  app.get("/health", async () => {
    const [database, redisCheck] = await Promise.all([checkDatabase(prisma), checkRedis(redisUrl)]);
    const checks: HealthChecks = { database, redis: redisCheck };
    if (redisCheck.status === "fail") {
      app.log.warn({ error: redisCheck.error }, "redis health check failed");
    }
    return {
      service: SERVICE_NAME,
      status: deriveOverallStatus(checks),
      checkedAt: nowIso(),
      checks,
    };
  });

  app.get("/ready", async (_request, reply) => {
    const [database, redisCheck] = await Promise.all([checkDatabase(prisma), checkRedis(redisUrl)]);
    const checks: HealthChecks = { database, redis: redisCheck };
    const { status, httpCode } = deriveReadyStatus(checks);
    if (status === "not_ready") {
      app.log.error({ checks }, "service not ready");
    }
    return reply.code(httpCode).send({
      service: SERVICE_NAME,
      status,
      checkedAt: nowIso(),
      checks,
    });
  });
}
