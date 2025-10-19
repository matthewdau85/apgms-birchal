import type { FastifyInstance, FastifyLoggerOptions } from "fastify";

type ReqWithMeta = {
  __start?: bigint;
};

export function buildLogger(): FastifyLoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "api-gateway" },
  };
}

export function registerLogging(app: FastifyInstance) {
  app.addHook("onRequest", async (req) => {
    (req as unknown as ReqWithMeta).__start = process.hrtime.bigint();
    const orgId = req.headers["x-org-id"];
    const route = req.routerPath ?? req.url;
    (req as any).log = app.log.child({
      req_id: req.id,
      orgId: typeof orgId === "string" ? orgId : undefined,
      route,
    });
  });

  app.addHook("onResponse", async (req, reply) => {
    const start = (req as unknown as ReqWithMeta).__start;
    const latencyMs = start
      ? Number(process.hrtime.bigint() - start) / 1_000_000
      : undefined;

    req.log.info(
      {
        statusCode: reply.statusCode,
        latencyMs,
      },
      "request.completed",
    );
  });
}
