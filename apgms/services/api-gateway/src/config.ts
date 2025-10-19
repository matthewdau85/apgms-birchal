import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const configSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),
    CORS_ALLOWLIST: z
      .string()
      .optional()
      .default("*"),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
    RATE_LIMIT_TIME_WINDOW: z
      .union([z.coerce.number().positive(), z.string().min(1)])
      .default("1 minute"),
    LOG_LEVEL: z.string().optional().default("info"),
  })
  .transform((env) => ({
    ...env,
    corsAllowlist: env.CORS_ALLOWLIST.split(",").map((origin) => origin.trim()).filter(Boolean),
  }));

type EnvConfig = z.infer<typeof configSchema> & {
  corsAllowlist: string[];
};

const env = configSchema.parse(process.env) as EnvConfig;

const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  corsAllowlist: env.corsAllowlist.length > 0 ? env.corsAllowlist : ["*"],
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW,
  },
  logLevel: env.LOG_LEVEL ?? "info",
} as const;

export type AppConfig = typeof config;

export default config;
