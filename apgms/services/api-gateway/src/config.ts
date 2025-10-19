import { z } from "zod";

const envKeys = [
  "PORT",
  "ALLOWED_ORIGINS",
  "RATE_LIMIT_MAX",
  "REDIS_URL",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "JWT_SECRET",
  "JWT_PUBLIC_KEY",
  "JWT_PRIVATE_KEY",
  "DATABASE_URL",
] as const;

type EnvKey = (typeof envKeys)[number];

type RawEnv = Record<EnvKey, string | undefined>;

const EnvSchema = z
  .object({
    PORT: z
      .coerce.number({ invalid_type_error: "PORT must be a number" })
      .int({ message: "PORT must be an integer" })
      .min(1, { message: "PORT must be between 1 and 65535" })
      .max(65535, { message: "PORT must be between 1 and 65535" }),
    ALLOWED_ORIGINS: z
      .string({ required_error: "ALLOWED_ORIGINS is required" })
      .min(1, { message: "ALLOWED_ORIGINS is required" })
      .transform((value) => {
        if (value.trim() === "*") {
          return ["*"];
        }
        return value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean);
      })
      .refine((origins) => origins.length > 0, {
        message: "ALLOWED_ORIGINS must include at least one origin or '*'",
      }),
    RATE_LIMIT_MAX: z
      .coerce.number({ invalid_type_error: "RATE_LIMIT_MAX must be a number" })
      .int({ message: "RATE_LIMIT_MAX must be an integer" })
      .min(1, { message: "RATE_LIMIT_MAX must be greater than 0" }),
    REDIS_URL: z
      .string({ required_error: "REDIS_URL is required" })
      .min(1, { message: "REDIS_URL is required" })
      .refine((value) => value.includes("://"), {
        message: "REDIS_URL must be a valid connection string",
      }),
    JWT_ISSUER: z
      .string({ required_error: "JWT_ISSUER is required" })
      .min(1, { message: "JWT_ISSUER is required" }),
    JWT_AUDIENCE: z
      .string({ required_error: "JWT_AUDIENCE is required" })
      .min(1, { message: "JWT_AUDIENCE is required" }),
    JWT_SECRET: z
      .string()
      .min(32, {
        message: "JWT_SECRET must be at least 32 characters to ensure entropy",
      })
      .optional(),
    JWT_PUBLIC_KEY: z.string().min(1, { message: "JWT_PUBLIC_KEY is required" }).optional(),
    JWT_PRIVATE_KEY: z
      .string()
      .min(1, { message: "JWT_PRIVATE_KEY is required" })
      .optional(),
    DATABASE_URL: z
      .string({ required_error: "DATABASE_URL is required" })
      .min(1, { message: "DATABASE_URL is required" })
      .refine((value) => value.includes("://"), {
        message: "DATABASE_URL must be a valid connection string",
      }),
  })
  .superRefine((data, ctx) => {
    const hasSecret = Boolean(data.JWT_SECRET);
    const hasPublic = Boolean(data.JWT_PUBLIC_KEY);
    const hasPrivate = Boolean(data.JWT_PRIVATE_KEY);

    if (hasSecret && (hasPublic || hasPrivate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "Provide either JWT_SECRET or JWT_PUBLIC_KEY/JWT_PRIVATE_KEY, not both.",
      });
    }

    if (!hasSecret && (!hasPublic || !hasPrivate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message:
          "You must configure JWT_SECRET or both JWT_PUBLIC_KEY and JWT_PRIVATE_KEY for signing tokens.",
      });
    }
  });

type Env = z.infer<typeof EnvSchema>;

function normalizeKey(key?: string | null): string | undefined {
  if (!key) {
    return undefined;
  }
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

function formatIssues(issues: z.ZodIssue[]): string {
  const lines = issues.map((issue) => {
    const path = issue.path.join(".") || "environment";
    return `- ${path}: ${issue.message}`;
  });
  return ["Invalid environment configuration:", ...lines].join("\n");
}

function pickEnv(): RawEnv {
  return envKeys.reduce<RawEnv>((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, Object.create(null));
}

const parsedEnv = EnvSchema.safeParse({
  ...pickEnv(),
  JWT_PUBLIC_KEY: normalizeKey(process.env.JWT_PUBLIC_KEY),
  JWT_PRIVATE_KEY: normalizeKey(process.env.JWT_PRIVATE_KEY),
});

if (!parsedEnv.success) {
  throw new Error(formatIssues(parsedEnv.error.issues));
}

const env = parsedEnv.data satisfies Env;

export const config = {
  port: env.PORT,
  allowedOrigins: env.ALLOWED_ORIGINS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  redisUrl: env.REDIS_URL,
  jwt: env.JWT_SECRET
    ? ({
        strategy: "secret" as const,
        secret: env.JWT_SECRET,
      } satisfies { strategy: "secret"; secret: string })
    : ({
        strategy: "rsa" as const,
        publicKey: env.JWT_PUBLIC_KEY!,
        privateKey: env.JWT_PRIVATE_KEY!,
      } satisfies { strategy: "rsa"; publicKey: string; privateKey: string }),
  jwtIssuer: env.JWT_ISSUER,
  jwtAudience: env.JWT_AUDIENCE,
  databaseUrl: env.DATABASE_URL,
};

export type AppConfig = typeof config;
