import { z } from "zod";

const rawSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  ALLOWED_ORIGINS: z.string().min(1, "ALLOWED_ORIGINS is required"),
  AUTH_ISSUER: z.string().min(1, "AUTH_ISSUER is required"),
  AUTH_AUDIENCE: z.string().min(1, "AUTH_AUDIENCE is required"),
  AUTH_BYPASS: z.string().optional(),
  WEBHOOK_SECRET: z.string().min(1, "WEBHOOK_SECRET is required"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  NODE_ENV: z.enum(["development", "test", "staging", "production"]),
  PORT: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) {
        return 3000;
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PORT must be a number" });
        return z.NEVER;
      }
      return parsed;
    }),
});

type RawConfig = z.input<typeof rawSchema>;

const truthyValues = new Set(["1", "true", "yes", "y", "on"]);

function parseAllowedOrigins(value: string): string[] | true {
  const trimmed = value.trim();
  if (trimmed === "*") {
    return true;
  }
  const origins = trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (origins.length === 0) {
    throw new Error("ALLOWED_ORIGINS must contain at least one origin or be '*'");
  }
  return origins;
}

function normalizeEndpoint(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.replace(/\/$/, "");
}

const rawConfig: RawConfig = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? "",
  AUTH_ISSUER: process.env.AUTH_ISSUER ?? "",
  AUTH_AUDIENCE: process.env.AUTH_AUDIENCE ?? "",
  AUTH_BYPASS: process.env.AUTH_BYPASS,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? "",
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  LOG_LEVEL: (process.env.LOG_LEVEL ?? "") as RawConfig["LOG_LEVEL"],
  NODE_ENV: (process.env.NODE_ENV ?? "") as RawConfig["NODE_ENV"],
  PORT: process.env.PORT,
};

const parsed = rawSchema.safeParse(rawConfig);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Configuration validation failed: ${formatted}`);
}

const authBypass = rawConfig.AUTH_BYPASS
  ? truthyValues.has(rawConfig.AUTH_BYPASS.trim().toLowerCase())
  : false;

const allowedOrigins = parseAllowedOrigins(parsed.data.ALLOWED_ORIGINS);

function deepFreeze<T>(object: T): T {
  if (object && typeof object === "object" && !Object.isFrozen(object)) {
    Object.freeze(object);
    for (const value of Object.values(object as Record<string, unknown>)) {
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        deepFreeze(value as Record<string, unknown>);
      }
    }
  }
  return object;
}

const appConfig = deepFreeze({
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  http: {
    allowedOrigins,
    port: parsed.data.PORT,
    host: "0.0.0.0",
  },
  auth: {
    issuer: parsed.data.AUTH_ISSUER,
    audience: parsed.data.AUTH_AUDIENCE,
    bypass: authBypass,
  },
  webhook: {
    secret: parsed.data.WEBHOOK_SECRET,
  },
  telemetry: {
    otlpEndpoint: normalizeEndpoint(parsed.data.OTEL_EXPORTER_OTLP_ENDPOINT),
  },
  logging: {
    level: parsed.data.LOG_LEVEL,
  },
  nodeEnv: parsed.data.NODE_ENV,
} as const);

export type AppConfig = typeof appConfig;

export const config: AppConfig = appConfig;
