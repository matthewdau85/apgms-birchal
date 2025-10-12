import dotenv from "dotenv";

dotenv.config();

const DEFAULT_PORT = 3000;

const parsePort = (value: string | undefined): number => {
  if (!value) return DEFAULT_PORT;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
};

const parseCorsOrigin = (
  value: string | undefined,
): true | false | string | string[] => {
  if (value === undefined || value.trim() === "") {
    return true;
  }

  const normalized = value.trim();
  if (normalized.toLowerCase() === "true") return true;
  if (normalized.toLowerCase() === "false") return false;

  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : normalized;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parsePort(process.env.PORT),
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: parseCorsOrigin(process.env.CORS_ORIGIN),
};
