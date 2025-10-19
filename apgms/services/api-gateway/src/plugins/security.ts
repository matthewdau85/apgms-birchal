import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, RouteOptions } from "fastify";

const MINUTE_IN_MS = 60_000;

function parseAllowList(envValue: string | undefined): string[] {
  if (!envValue) {
    return [];
  }
  return envValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveRateLimit(): number {
  const value = Number(process.env.API_GATEWAY_RATE_LIMIT_MAX ?? "100");
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function resolveBodyLimit(): number {
  const defaultLimit = 512 * 1024;
  const value = Number(process.env.API_GATEWAY_BODY_LIMIT_BYTES ?? defaultLimit);
  return Number.isFinite(value) && value > 0 ? value : defaultLimit;
}

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  const allowList = parseAllowList(process.env.API_GATEWAY_CORS_ALLOWLIST);
  await app.register(cors, {
    credentials: true,
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowList.length === 0 || allowList.includes(origin)) {
        cb(null, true);
        return;
      }

      const error = new Error("Origin not allowed");
      (error as any).statusCode = 403;
      cb(error, false);
    },
  });

  await rateLimit(app, {
    max: resolveRateLimit(),
    timeWindow: MINUTE_IN_MS,
    keyGenerator: (request) => request.ip,
  });

  const bodyLimit = resolveBodyLimit();
  app.addHook("onRoute", (routeOptions: RouteOptions) => {
    if (routeOptions.bodyLimit === undefined) {
      routeOptions.bodyLimit = bodyLimit;
    }
  });
}

export type RegisterSecurity = typeof registerSecurity;
