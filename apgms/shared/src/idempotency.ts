import crypto from "node:crypto";
import type Redis from "ioredis";

type Primitive = string | number | boolean | null;

type CanonicalValue = Primitive | CanonicalValue[] | { [key: string]: CanonicalValue };

export interface IdempotencyKeyComponents {
  orgId: string;
  method: string;
  path: string;
  bodyHash: string;
  key: string;
}

export type IdempotencyRecord =
  | {
      state: "pending";
      createdAt: string;
    }
  | {
      state: "completed";
      createdAt: string;
      statusCode: number;
      body: unknown;
      headers?: Record<string, string>;
    };

export interface IdempotencyResponsePayload {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

const IDEMPOTENCY_PREFIX = "idemp:v1";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

type SetMode = "NX" | "XX";

function canonicalise(value: unknown): CanonicalValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalise(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, canonicalise(v)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return entries.reduce<Record<string, CanonicalValue>>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});
  }

  return String(value);
}

function serialiseCanonical(value: CanonicalValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => serialiseCanonical(item)).join(",")}]`;
  }

  const entries = Object.entries(value)
    .map(([k, v]) => `${JSON.stringify(k)}:${serialiseCanonical(v)}`)
    .join(",");

  return `{${entries}}`;
}

function formatRedisKey({ orgId, method, path, bodyHash, key }: IdempotencyKeyComponents): string {
  const parts = [IDEMPOTENCY_PREFIX, orgId, method.toUpperCase(), path, bodyHash, key];
  return parts
    .map((part) =>
      part
        .replace(/:/g, "%3A")
        .replace(/\s+/g, "_")
        .trim()
    )
    .join(":");
}

async function setWithMode(
  redis: Redis,
  redisKey: string,
  payload: IdempotencyRecord,
  mode: SetMode,
  ttlSeconds: number,
) {
  const response = await redis.set(
    redisKey,
    JSON.stringify(payload),
    mode,
    "EX",
    ttlSeconds,
  );

  return response === "OK";
}

export function hashRequestBody(body: unknown): string {
  const canonical = serialiseCanonical(canonicalise(body ?? null));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export async function getIdempotencyRecord(
  redis: Redis,
  components: IdempotencyKeyComponents,
): Promise<IdempotencyRecord | null> {
  const redisKey = formatRedisKey(components);
  const raw = await redis.get(redisKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as IdempotencyRecord;
    if (!parsed.state || !("createdAt" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function claimIdempotencyKey(
  redis: Redis,
  components: IdempotencyKeyComponents,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const redisKey = formatRedisKey(components);
  const record: IdempotencyRecord = {
    state: "pending",
    createdAt: new Date().toISOString(),
  };

  return setWithMode(redis, redisKey, record, "NX", ttlSeconds);
}

export async function storeIdempotencySuccess(
  redis: Redis,
  components: IdempotencyKeyComponents,
  response: IdempotencyResponsePayload,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const redisKey = formatRedisKey(components);
  const record: IdempotencyRecord = {
    state: "completed",
    createdAt: new Date().toISOString(),
    statusCode: response.statusCode,
    body: response.body,
    headers: response.headers,
  };

  await setWithMode(redis, redisKey, record, "XX", ttlSeconds);
}

export async function clearIdempotencyKey(
  redis: Redis,
  components: IdempotencyKeyComponents,
): Promise<void> {
  const redisKey = formatRedisKey(components);
  await redis.del(redisKey);
}
