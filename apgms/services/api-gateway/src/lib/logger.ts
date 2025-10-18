import fs from "node:fs";
import type { FastifyBaseLogger } from "fastify";
import pino, { type LoggerOptions } from "pino";

const fallbackLoggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
};

const fallbackLogger = pino(fallbackLoggerOptions);

export let appLog: FastifyBaseLogger = fallbackLogger;

export const setAppLogger = (logger?: FastifyBaseLogger) => {
  if (logger) {
    appLog = logger;
  }
};

type SecurityLogEventDetails = {
  decision: string;
  route: string;
  principal?: string;
  orgId?: string;
  ip?: string;
  reason?: string;
};

const securityLogPath = process.env.SECURITY_LOG_PATH;
const securityStream = securityLogPath
  ? fs.createWriteStream(securityLogPath, { flags: "a" })
  : process.stdout;

export const secLog = (event: string, details: SecurityLogEventDetails) => {
  const record = {
    ts: new Date().toISOString(),
    event,
    ...details,
  } satisfies Record<string, unknown>;

  securityStream.write(`${JSON.stringify(record)}\n`);
};
