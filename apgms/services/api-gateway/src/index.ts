import Fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import cors, { FastifyCorsOptions } from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import config from "./config";
import { prisma } from "../../../shared/src/db";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      orgId?: string | null;
      scope?: string[];
    };
    orgId?: string;
    requestId?: string;
  }
}

const PUBLIC_ROUTE_PREFIXES = [
  "/health",
  "/ready",
  "/metrics",
  "/docs",
  "/openapi.json",
];

const isPublicRoute = (request: FastifyRequest): boolean => {
  const routePath = request.routerPath ?? request.url;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    routePath === prefix || routePath.startsWith(`${prefix}/`),
  );
};

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
});

await app.register(helmet);

await app.register(rateLimit, {
  max: config.rateLimit.max,
  timeWindow: config.rateLimit.timeWindow,
});

const corsOptions: FastifyCorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsAllowlist.includes("*")) {
      callback(null, true);
      return;
    }

    if (config.corsAllowlist.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed"), false);
  },
  credentials: true,
};
await app.register(cors, corsOptions);

app.addHook("onRequest", (request, reply, done) => {
  const headerName = "x-request-id";
  const existingRequestId = request.headers[headerName] as string | undefined;
  const requestId = existingRequestId ?? randomUUID();

  reply.header(headerName, requestId);
  request.requestId = requestId;
  done();
});

const redisPlugin = async (instance: FastifyInstance) => {
  const client = new Redis(config.redisUrl);

  instance.decorate("redis", client);
  instance.addHook("onClose", async (closeInstance) => {
    await closeInstance.redis.quit();
  });
};
await app.register(redisPlugin);

const authPlugin = async (instance: FastifyInstance) => {
  instance.decorateRequest("user", null);

  instance.addHook("preHandler", async (request, reply) => {
    if (isPublicRoute(request)) {
      return;
    }

    const authorization = request.headers.authorization;
    if (typeof authorization !== "string" || authorization.trim().length === 0) {
      reply.code(401).send({ error: "unauthorized" });
      return reply;
    }

    const token = authorization.replace(/^[Bb]earer\s+/u, "").trim();
    const orgHeader = request.headers["x-org-id"];

    request.user = {
      id: token,
      orgId: typeof orgHeader === "string" ? orgHeader : null,
      scope: [],
    };
  });
};
await app.register(authPlugin);

const orgScopeHook = async (request: FastifyRequest, reply: FastifyReply) => {
  if (isPublicRoute(request)) {
    return;
  }

  const orgId = request.user?.orgId ?? (typeof request.headers["x-org-id"] === "string" ? request.headers["x-org-id"] : undefined);

  if (!orgId) {
    reply.code(403).send({ error: "forbidden" });
    return reply;
  }

  request.orgId = orgId;
};
app.addHook("preHandler", orgScopeHook);

await app.register(swagger, {
  openapi: {
    info: {
      title: "APGMS API Gateway",
      version: "1.0.0",
      description: "API gateway for APGMS services.",
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
});

app.get("/openapi.json", async () => app.swagger());

await app.register(async (instance) => {
  instance.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; version=0.0.4");
    const uptime = process.uptime();
    return [
      "# HELP service_uptime_seconds The uptime of the API gateway.",
      "# TYPE service_uptime_seconds gauge",
      `service_uptime_seconds ${uptime.toFixed(0)}`,
    ].join("\n");
  });

  instance.get("/health", async () => ({
    status: "ok",
    service: "api-gateway",
  }));

  instance.get("/ready", async (_request, reply) => {
    const checks = {
      redis: false,
      database: false,
    } as const;

    const mutableChecks = { ...checks };

    try {
      await instance.redis.ping();
      mutableChecks.redis = true;
    } catch (error) {
      instance.log.error({ err: error }, "redis readiness check failed");
    }

    try {
      await prisma.$queryRaw(Prisma.sql`SELECT 1`);
      mutableChecks.database = true;
    } catch (error) {
      instance.log.error({ err: error }, "database readiness check failed");
    }

    const ready = mutableChecks.redis && mutableChecks.database;

    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks: mutableChecks,
    });
  });
});

await app.register(async (instance) => {
  instance.get("/reports", async (request) => {
    const orgId = request.orgId ?? null;
    return {
      data: [],
      orgId,
    };
  });

  instance.get("/reports/:reportId", async (request) => {
    const { reportId } = request.params as { reportId: string };
    const orgId = request.orgId ?? null;

    return {
      reportId,
      orgId,
      status: "pending",
    };
  });
}, { prefix: "/v1" });

app.ready(() => {
  app.log.info(app.printRoutes());
});

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info({ port: config.port }, "api-gateway listening");
} catch (error) {
  app.log.error({ err: error }, "failed to start api-gateway");
  process.exit(1);
}
