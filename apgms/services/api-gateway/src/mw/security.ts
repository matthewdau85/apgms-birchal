import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";

const parseList = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

const defaultOrigins = ["http://localhost:3000"];

export const registerSecurity = async (app: FastifyInstance): Promise<void> => {
  const allowedOrigins = parseList(
    process.env.API_GATEWAY_CORS_ALLOWLIST ?? process.env.CORS_ALLOWLIST,
  );
  const origins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("origin_not_allowed"), false);
    },
    credentials: true,
  });

  const max = Number(process.env.API_GATEWAY_RATE_LIMIT_RPM ?? process.env.RATE_LIMIT_RPM ?? 100);
  const allowList = parseList(process.env.API_GATEWAY_RATE_LIMIT_ALLOWLIST);

  await app.register(rateLimit, {
    max,
    timeWindow: "1 minute",
    allowList: allowList.length > 0 ? allowList : undefined,
  });

  const bodyLimit = Number(process.env.API_GATEWAY_BODY_LIMIT ?? 512 * 1024);
  app.addHook("onRoute", (routeOptions) => {
    if (routeOptions.bodyLimit === undefined) {
      routeOptions.bodyLimit = bodyLimit;
    }
  });
};
