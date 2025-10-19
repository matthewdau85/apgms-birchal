import { config as loadEnv } from "dotenv";
import { z } from "zod";

const dotenvResult = loadEnv();

if (dotenvResult.error && (dotenvResult.error as NodeJS.ErrnoException).code !== "ENOENT") {
  throw new Error(`Unable to load environment variables: ${dotenvResult.error.message}`);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .preprocess((value) => {
      if (value === undefined || value === "") {
        return 3000;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }, z.number().int().min(0).max(65535)),
  ALLOWED_ORIGINS: z
    .preprocess((value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (trimmed === "*") {
        return ["*"];
      }
      return trimmed
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
    },
    z.array(z.string()).nonempty("ALLOWED_ORIGINS must include at least one origin or be '*'")
  ),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHADOW_DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  RATE_LIMIT_MAX: z.preprocess((value) => {
    if (value === undefined || value === "") {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }, z.number().int().positive()),
  REQUEST_BODY_LIMIT: z.string().min(1, "REQUEST_BODY_LIMIT is required"),
  JWT_ISSUER: z.string().min(1, "JWT_ISSUER is required"),
  JWT_AUDIENCE: z.string().min(1, "JWT_AUDIENCE is required"),
  JWT_PRIVATE_KEY: z.preprocess((value) =>
    typeof value === "string" ? value.replace(/\\n/g, "\n") : value,
  z.string().min(1, "JWT_PRIVATE_KEY is required")),
  JWT_PUBLIC_KEY: z.preprocess((value) =>
    typeof value === "string" ? value.replace(/\\n/g, "\n") : value,
  z.string().min(1, "JWT_PUBLIC_KEY is required")),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url("OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL").optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const fieldErrors = parsedEnv.error.flatten().fieldErrors;
  const formErrors = parsedEnv.error.flatten().formErrors;

  const messages = [
    ...Object.entries(fieldErrors).flatMap(([field, errors]) =>
      (errors ?? []).map((message) => `${field}: ${message}`),
    ),
    ...formErrors,
  ];

  const header = "❌ Invalid environment configuration";
  const details = messages.length > 0 ? messages.join("\n  - ") : parsedEnv.error.message;
  console.error(`${header}:\n  - ${details}`);
  process.exit(1);
}

const rawEnv = parsedEnv.data;

const allowAllOrigins = rawEnv.ALLOWED_ORIGINS.length === 1 && rawEnv.ALLOWED_ORIGINS[0] === "*";

export const config = Object.freeze({
  NODE_ENV: rawEnv.NODE_ENV,
  PORT: rawEnv.PORT,
  ALLOWED_ORIGINS: rawEnv.ALLOWED_ORIGINS,
  DATABASE_URL: rawEnv.DATABASE_URL,
  SHADOW_DATABASE_URL: rawEnv.SHADOW_DATABASE_URL,
  REDIS_URL: rawEnv.REDIS_URL,
  RATE_LIMIT_MAX: rawEnv.RATE_LIMIT_MAX,
  REQUEST_BODY_LIMIT: rawEnv.REQUEST_BODY_LIMIT,
  JWT_ISSUER: rawEnv.JWT_ISSUER,
  JWT_AUDIENCE: rawEnv.JWT_AUDIENCE,
  JWT_PRIVATE_KEY: rawEnv.JWT_PRIVATE_KEY,
  JWT_PUBLIC_KEY: rawEnv.JWT_PUBLIC_KEY,
  OTEL_EXPORTER_OTLP_ENDPOINT: rawEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
  corsOrigin: allowAllOrigins ? true : rawEnv.ALLOWED_ORIGINS,
});

export type AppConfig = typeof config;
