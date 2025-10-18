export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogMetadata =
  | Record<string, unknown>
  | Error
  | string
  | number
  | boolean
  | null
  | undefined;

export interface LogContext {
  service: string;
  module?: string;
  [key: string]: string | undefined;
}

export interface Logger {
  child(context: Partial<LogContext>): Logger;
  trace(message: string, meta?: LogMetadata): void;
  debug(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  warn(message: string, meta?: LogMetadata): void;
  error(message: string, meta?: LogMetadata): void;
  fatal(message: string, meta?: LogMetadata): void;
}

const consoleMethod: Record<LogLevel, keyof Console> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
};

function normalizeMeta(meta: LogMetadata): Record<string, unknown> | undefined {
  if (meta === undefined) {
    return undefined;
  }

  if (meta instanceof Error) {
    return {
      error: {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
      },
    };
  }

  if (meta === null) {
    return { value: null };
  }

  if (typeof meta === "object") {
    return meta as Record<string, unknown>;
  }

  return { value: meta };
}

function log(level: LogLevel, context: LogContext, message: string, meta?: LogMetadata) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    service: context.service,
    msg: message,
  };

  const { module: moduleName, ...restContext } = context;
  if (moduleName) {
    entry.module = moduleName;
  }

  for (const [key, value] of Object.entries(restContext)) {
    if (key === "service" || key === "module") {
      continue;
    }
    if (value !== undefined) {
      entry[key] = value;
    }
  }

  const normalizedMeta = normalizeMeta(meta);
  if (normalizedMeta) {
    entry.meta = normalizedMeta;
  }

  const method = consoleMethod[level];
  const serialized = JSON.stringify(entry);
  console[method](serialized);
}

export function createLogger(context: LogContext): Logger {
  return {
    child(childContext) {
      return createLogger({ ...context, ...childContext });
    },
    trace(message, meta) {
      log("trace", context, message, meta);
    },
    debug(message, meta) {
      log("debug", context, message, meta);
    },
    info(message, meta) {
      log("info", context, message, meta);
    },
    warn(message, meta) {
      log("warn", context, message, meta);
    },
    error(message, meta) {
      log("error", context, message, meta);
    },
    fatal(message, meta) {
      log("fatal", context, message, meta);
    },
  };
}
