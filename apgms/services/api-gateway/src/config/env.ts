const requiredVars = ["DATABASE_URL", "JWT_SECRET", "REDIS_URL", "ALLOWED_ORIGINS"] as const;

type RequiredVar = (typeof requiredVars)[number];

const readRequired = (name: RequiredVar): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parseAllowedOrigins = (raw: string): true | string[] => {
  if (raw.trim() === "*") {
    return true;
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : true;
};

const parsePort = (value: string | undefined): number => {
  if (value === undefined) {
    return 3000;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`PORT must be a positive integer when provided (received: ${value})`);
  }

  return parsed;
};

export const env = {
  databaseUrl: readRequired("DATABASE_URL"),
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? null,
  jwtSecret: readRequired("JWT_SECRET"),
  redisUrl: readRequired("REDIS_URL"),
  allowedOrigins: parseAllowedOrigins(readRequired("ALLOWED_ORIGINS")),
  port: parsePort(process.env.PORT),
} as const;
