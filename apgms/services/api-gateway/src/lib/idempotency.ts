type RedisLike = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode?: "NX" | "XX",
    durationMode?: "EX" | "PX",
    duration?: number,
  ): Promise<string | null>;
  del(key: string): Promise<number>;
  quit(): Promise<unknown>;
};

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    mode?: "NX" | "XX",
    durationMode?: "EX" | "PX",
    duration?: number,
  ): Promise<string | null> {
    const exists = await this.get(key);
    if (mode === "NX" && exists !== null) {
      return null;
    }
    if (mode === "XX" && exists === null) {
      return null;
    }
    let expiresAt: number | null = null;
    if (durationMode && duration) {
      const ttlMs = durationMode === "EX" ? duration * 1000 : duration;
      expiresAt = Date.now() + ttlMs;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    const hadKey = this.store.delete(key);
    return hadKey ? 1 : 0;
  }

  async quit(): Promise<void> {
    this.store.clear();
  }
}

let redisClient: RedisLike | null = null;
let redisInitializationAttempted = false;

export class IdempotencyConflictError extends Error {
  constructor() {
    super("idempotency_key_conflict");
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyInProgressError extends Error {
  constructor() {
    super("idempotency_in_progress");
    this.name = "IdempotencyInProgressError";
  }
}

async function getRedis(): Promise<RedisLike> {
  if (!redisClient) {
    const url = process.env.IDEMPOTENCY_REDIS_URL;
    if (url && !redisInitializationAttempted) {
      redisInitializationAttempted = true;
      try {
        const module = await import("ioredis");
        const Redis = module.default as any;
        redisClient = new Redis(url, { lazyConnect: true });
      } catch (error) {
        console.warn("Failed to initialize Redis, falling back to in-memory store", error);
      }
    }
    if (!redisClient) {
      redisClient = new InMemoryRedis();
    }
  }
  return redisClient;
}

const IDEMPOTENCY_PREFIX = "idempotency:key:";
const IDEMPOTENCY_LOCK_PREFIX = "idempotency:lock:";
const DEFAULT_TTL_SECONDS = 60 * 10;

export async function getOrSet<T>(
  key: string,
  hash: string,
  compute: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<T> {
  const client = await getRedis();
  const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;
  const lockKey = `${IDEMPOTENCY_LOCK_PREFIX}${key}`;

  const existingRaw = await client.get(redisKey);
  if (existingRaw) {
    const parsed = JSON.parse(existingRaw) as { hash: string; value: T };
    if (parsed.hash !== hash) {
      throw new IdempotencyConflictError();
    }
    return parsed.value;
  }

  const acquired = await client.set(lockKey, hash, "NX", "EX", 30);
  if (acquired === null) {
    throw new IdempotencyInProgressError();
  }

  try {
    const result = await compute();
    await client.set(
      redisKey,
      JSON.stringify({ hash, value: result }),
      "EX",
      ttlSeconds,
    );
    return result;
  } finally {
    await client.del(lockKey);
  }
}

export async function rememberNonce(
  nonce: string,
  ttlSeconds: number,
): Promise<boolean> {
  const client = await getRedis();
  const key = `idempotency:nonce:${nonce}`;
  const stored = await client.set(key, "1", "NX", "EX", ttlSeconds);
  return stored === "OK";
}

export async function closeIdempotencyStore() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisInitializationAttempted = false;
  }
}

export function __resetInMemoryIdempotencyStore() {
  if (redisClient instanceof InMemoryRedis) {
    redisClient = null;
  }
  redisInitializationAttempted = false;
}
