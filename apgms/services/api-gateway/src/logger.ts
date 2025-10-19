import type { FastifyServerOptions } from "fastify";

const REDACTION_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers[\"set-cookie\"]",
  "req.body",
  "req.params",
  "req.query",
  "res.headers",
  "res.payload",
  "DATABASE_URL",
  "email",
  "*.email",
  "password",
  "*.password",
  "token",
  "*.token",
] as const;

export const CENSOR = "[REDACTED]";

export const loggerOptions: Exclude<FastifyServerOptions["logger"], boolean> = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [...REDACTION_PATHS],
    censor: CENSOR,
  },
};

export { REDACTION_PATHS };
