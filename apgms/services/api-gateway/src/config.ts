import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  PORT: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  API_SIGNING_SECRET: z.string().default("dev-api-secret"),
  API_KEYS: z.string().default("{}"),
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX: z.string().optional(),
  BODY_LIMIT_BYTES: z.string().optional(),
  WEBHOOK_SECRET: z.string().default("dev-webhook-secret"),
  AUDIT_PRIVATE_KEY: z.string().optional(),
  AUDIT_PUBLIC_KEY: z.string().optional(),
});

const env = envSchema.parse(process.env);

function parseApiKeys(value: string) {
  const raw = value.trim();
  if (!raw) {
    return {};
  }

  if (raw.startsWith("{")) {
    return JSON.parse(raw);
  }

  const record: Record<string, { orgId: string; scopes: string[] }> = {};
  for (const segment of raw.split(",")) {
    const [keyId, orgId] = segment.split(":");
    if (!keyId || !orgId) {
      continue;
    }
    record[keyId.trim()] = { orgId: orgId.trim(), scopes: [] };
  }
  return record;
}

const parsed = parseApiKeys(env.API_KEYS || "");
const normalizedApiKeys: Record<string, { orgId: string; scopes: string[] }> = {};
for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
  if (typeof value === "string") {
    normalizedApiKeys[key] = { orgId: value, scopes: [] };
  } else {
    const maybeOrgId =
      value && typeof value === "object" && "orgId" in value
        ? (value as any).orgId
        : null;
    if (typeof maybeOrgId !== "string") {
      continue;
    }
    const scopesValue =
      value && typeof value === "object" && "scopes" in value
        ? (value as any).scopes
        : [];
    const scopes = Array.isArray(scopesValue)
      ? scopesValue.filter((item) => typeof item === "string")
      : [];
    normalizedApiKeys[key] = {
      orgId: maybeOrgId,
      scopes,
    };
  }
}
const parsedApiKeys = normalizedApiKeys;

const corsOrigins = (env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const rateLimitWindowMs = env.RATE_LIMIT_WINDOW_MS
  ? Number(env.RATE_LIMIT_WINDOW_MS)
  : 60_000;
const rateLimitMax = env.RATE_LIMIT_MAX
  ? Number(env.RATE_LIMIT_MAX)
  : 120;
const bodyLimit = env.BODY_LIMIT_BYTES
  ? Number(env.BODY_LIMIT_BYTES)
  : 1 * 1024 * 1024;

const auditSeed = createHash("sha256")
  .update(env.AUDIT_PRIVATE_KEY ?? env.API_SIGNING_SECRET)
  .digest();

export const config = {
  port: Number(env.PORT ?? 3000),
  corsOrigins,
  apiSigningSecret: env.API_SIGNING_SECRET,
  apiKeys: parsedApiKeys,
  rateLimitWindowMs,
  rateLimitMax,
  bodyLimit,
  webhookSecret: env.WEBHOOK_SECRET,
  auditPrivateKey: env.AUDIT_PRIVATE_KEY,
  auditPublicKey: env.AUDIT_PUBLIC_KEY,
  auditSeed,
} as const;

export type ApiKeyRecord = typeof parsedApiKeys;
