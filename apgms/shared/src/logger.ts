import pino, { stdTimeFunctions, type LevelWithSilent, type Logger, type LoggerOptions } from "pino";

const baseLevel = (process.env.LOG_LEVEL ?? "info") as LevelWithSilent;

const defaultOptions: LoggerOptions = {
  level: baseLevel,
  timestamp: stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
};

export type { Logger } from "pino";

export function createLogger(options: LoggerOptions = {}): Logger {
  return pino({ ...defaultOptions, ...options, base: { ...(defaultOptions.base ?? {}), ...(options.base ?? {}) } });
}

export function createServiceLogger(serviceName: string, options: LoggerOptions = {}): Logger {
  return createLogger({ ...options, base: { service: serviceName, ...(options.base ?? {}) } });
}

export function childLogger<T extends { child(bindings: Record<string, unknown>): T }>(
  logger: T,
  context: Record<string, unknown>,
): T {
  return logger.child(context);
}
