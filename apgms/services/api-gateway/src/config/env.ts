import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: rootEnvPath });

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export interface AppConfig {
  port: number;
  host: string;
  jwtSecret: string;
  jwtAudience?: string;
  jwtIssuer?: string;
  requiredRoles: {
    userRead: string[];
    bankLineRead: string[];
    bankLineWrite: string[];
  };
  auditServiceUrl?: string;
  logLevel: LogLevel;
}

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseJSON = <T>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    return fallback;
  }
};

export const loadConfig = (): AppConfig => {
  const requiredSecret = process.env.JWT_SECRET;
  if (!requiredSecret) {
    throw new Error("JWT_SECRET must be configured for the API gateway");
  }

  const requiredRoles = parseJSON<Record<string, string[]>>(
    process.env.API_GATEWAY_REQUIRED_ROLES,
    {
      userRead: ["users:read"],
      bankLineRead: ["bank-lines:read"],
      bankLineWrite: ["bank-lines:write"],
    },
  );

  return {
    port: parseNumber(process.env.PORT, 3000),
    host: process.env.HOST ?? "0.0.0.0",
    jwtSecret: requiredSecret,
    jwtAudience: process.env.JWT_AUDIENCE,
    jwtIssuer: process.env.JWT_ISSUER,
    requiredRoles: {
      userRead: requiredRoles.userRead ?? ["users:read"],
      bankLineRead: requiredRoles.bankLineRead ?? ["bank-lines:read"],
      bankLineWrite: requiredRoles.bankLineWrite ?? ["bank-lines:write"],
    },
    auditServiceUrl: process.env.AUDIT_SERVICE_URL,
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  };
};
