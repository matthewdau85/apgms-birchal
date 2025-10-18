import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = "http://localhost:5173";
const DEFAULT_RATE_LIMIT_RPM = 600;
const DEFAULT_MAX_BODY_BYTES = 1_048_576;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    CORS_ALLOWLIST: z
      .string()
      .default(DEFAULT_CORS_ORIGIN)
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),
    RATE_LIMIT_RPM: z.coerce.number().int().positive().default(DEFAULT_RATE_LIMIT_RPM),
    MAX_BODY_BYTES: z.coerce.number().int().positive().default(DEFAULT_MAX_BODY_BYTES),
    REDIS_URL: z.string().url().optional(),
    SIGNER_PROVIDER: z.string().min(1).optional(),
    KMS_KEY_ID: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).optional(),
    SECURITY_LOG_PATH: z.string().min(1).optional(),
  })
  .transform((value) => ({
    ...value,
    CORS_ALLOWLIST:
      value.CORS_ALLOWLIST.length === 0 ? [DEFAULT_CORS_ORIGIN] : value.CORS_ALLOWLIST,
  }));

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formatted = parsedEnv.error.flatten();
  const details = Object.entries(formatted.fieldErrors)
    .map(([key, errors]) => `${key}: ${errors?.join(", ") ?? "unknown error"}`)
    .join("; ");
  throw new Error(`Invalid environment configuration${details.length ? ` - ${details}` : ""}`);
}

const rawConfig = parsedEnv.data;

export const config = {
  port: rawConfig.PORT,
  nodeEnv: rawConfig.NODE_ENV,
  corsAllowlist: rawConfig.CORS_ALLOWLIST,
  rateLimitRpm: rawConfig.RATE_LIMIT_RPM,
  maxBodyBytes: rawConfig.MAX_BODY_BYTES,
  redisUrl: rawConfig.REDIS_URL,
  signerProvider: rawConfig.SIGNER_PROVIDER,
  kmsKeyId: rawConfig.KMS_KEY_ID,
  awsRegion: rawConfig.AWS_REGION,
  securityLogPath: rawConfig.SECURITY_LOG_PATH,
} as const;

export type AppConfig = typeof config;

export const isProd = config.nodeEnv === "production";

type RequiredProdKey =
  | "redisUrl"
  | "signerProvider"
  | "kmsKeyId"
  | "awsRegion"
  | "securityLogPath";

const requiredProdKeyMap: Record<RequiredProdKey, string> = {
  redisUrl: "REDIS_URL",
  signerProvider: "SIGNER_PROVIDER",
  kmsKeyId: "KMS_KEY_ID",
  awsRegion: "AWS_REGION",
  securityLogPath: "SECURITY_LOG_PATH",
};

const requiredProdKeys = Object.keys(requiredProdKeyMap) as RequiredProdKey[];

if (isProd) {
  const missing = requiredProdKeys.filter((key) => !config[key]);
  if (missing.length > 0) {
    const envNames = missing.map((key) => requiredProdKeyMap[key]);
    throw new Error(
      `Missing required environment variables for production: ${envNames.join(", ")}`,
    );
  }
}
