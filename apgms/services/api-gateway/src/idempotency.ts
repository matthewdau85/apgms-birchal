import { setTimeout as delay } from "node:timers/promises";
import { redis } from "../../../shared/src";

const IDEMPOTENCY_KEY_PREFIX = "idem";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const PENDING_VALUE = JSON.stringify({ pending: true });
const WAIT_TIMEOUT_MS = 1000;
const WAIT_POLL_MS = 50;

export interface IdempotentResult<T> {
  statusCode: number;
  body: T;
}

function isPending(value: unknown): value is { pending: true } {
  return Boolean(value && typeof value === "object" && "pending" in value);
}

async function waitForCompletion<T>(key: string): Promise<IdempotentResult<T> | null> {
  const end = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < end) {
    const raw = await redis.get(key);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!isPending(parsed)) {
        return parsed;
      }
    } catch {
      await redis.del(key);
      return null;
    }
    await delay(WAIT_POLL_MS);
  }

  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return isPending(parsed) ? null : parsed;
  } catch {
    await redis.del(key);
    return null;
  }
}

async function readStoredResult<T>(key: string): Promise<IdempotentResult<T> | null> {
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (isPending(parsed)) {
      return waitForCompletion<T>(key);
    }
    return parsed;
  } catch {
    await redis.del(key);
    return null;
  }
}

export async function withIdempotency<T>(
  orgId: string,
  key: string | undefined,
  handler: () => Promise<IdempotentResult<T>>,
): Promise<IdempotentResult<T>> {
  if (!key) {
    return handler();
  }

  const redisKey = `${IDEMPOTENCY_KEY_PREFIX}:${orgId}:${key}`;

  const existing = await readStoredResult<T>(redisKey);
  if (existing) {
    return existing;
  }

  const created = await redis.set(redisKey, PENDING_VALUE, { NX: true, PX: IDEMPOTENCY_TTL_MS });
  if (created === null) {
    const stored = await readStoredResult<T>(redisKey);
    if (stored) {
      return stored;
    }
  }

  try {
    const result = await handler();
    const payload = JSON.stringify(result);
    const stored = await redis.set(redisKey, payload, { XX: true, PX: IDEMPOTENCY_TTL_MS });
    if (stored === null) {
      await redis.set(redisKey, payload, { PX: IDEMPOTENCY_TTL_MS });
    }
    return result;
  } catch (error) {
    await redis.del(redisKey);
    throw error;
  }
}
