const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
type Level = (typeof LEVELS)[number];

const levelWeights: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

type LoggerConfig = {
  serviceName: string;
  bindings?: Record<string, unknown>;
};

type LogMethod = (obj?: Record<string, unknown>, msg?: string) => void;

const normalizeLevel = (value: string | undefined): Level => {
  const normalized = value?.toLowerCase() ?? "info";
  return (LEVELS.find((lvl) => lvl === normalized) ?? "info") as Level;
};

const shouldLog = (currentLevel: Level, targetLevel: Level) =>
  levelWeights[targetLevel] >= levelWeights[currentLevel];

const formatLine = (
  level: Level,
  serviceName: string,
  bindings: Record<string, unknown>,
  payload?: Record<string, unknown>,
  message?: string,
) => {
  const body = {
    level,
    time: new Date().toISOString(),
    service: serviceName,
    ...bindings,
    ...(payload ?? {}),
  } as Record<string, unknown>;

  if (message) {
    body.message = message;
  }

  return body;
};

const writeLine = (data: Record<string, unknown>) => {
  if (process.env.LOG_PRETTY === "true") {
    const { level, message, service, time, ...rest } = data;
    const formatted = `[${time}] ${String(level).toUpperCase()} (${service}) ${
      message ?? ""
    } ${Object.keys(rest).length ? JSON.stringify(rest) : ""}`;
    process.stdout.write(`${formatted}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(data)}\n`);
};

const buildLogger = ({
  serviceName,
  bindings = {},
}: LoggerConfig & { bindings?: Record<string, unknown> }) => {
  const level = normalizeLevel(process.env.LOG_LEVEL);

  const log = (targetLevel: Level): LogMethod => (obj, msg) => {
    if (!shouldLog(level, targetLevel)) {
      return;
    }

    let payload: Record<string, unknown> | undefined;
    let message: string | undefined;

    if (typeof obj === "string" && msg === undefined) {
      message = obj;
    } else {
      payload = obj ?? {};
      message = msg;
    }

    if (payload) {
      for (const [key, value] of Object.entries(payload)) {
        if (value instanceof Error) {
          payload[key] = {
            message: value.message,
            stack: value.stack,
            name: value.name,
          };
        }
      }
    }

    const line = formatLine(targetLevel, serviceName, bindings, payload, message);
    writeLine(line);
  };

  const child = (extraBindings: Record<string, unknown>) =>
    buildLogger({ serviceName, bindings: { ...bindings, ...extraBindings } });

  return {
    level,
    child,
    trace: log("trace"),
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    fatal: log("fatal"),
  };
};

export const createLogger = ({ serviceName }: LoggerConfig) =>
  buildLogger({ serviceName, bindings: {} });

export type ServiceLogger = ReturnType<typeof createLogger>;
