export type RedisSetResult = "OK" | null;

interface StoredValue {
  value: string;
  expiresAt?: number;
}

export class InMemoryRedis {
  private store = new Map<string, StoredValue>();

  private isExpired(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt === undefined) {
      return false;
    }
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) {
      return null;
    }
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<RedisSetResult> {
    let mode: "NX" | "XX" | undefined;
    let ttlSeconds: number | undefined;

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (typeof arg === "string") {
        const upper = arg.toUpperCase();
        if (upper === "NX" || upper === "XX") {
          mode = upper;
        } else if (upper === "EX" || upper === "PX") {
          const ttlArg = args[i + 1];
          i += 1;
          const ttlNumeric = typeof ttlArg === "number" ? ttlArg : Number(ttlArg);
          if (!Number.isFinite(ttlNumeric)) {
            throw new Error("Invalid TTL value");
          }
          ttlSeconds = upper === "PX" ? ttlNumeric / 1000 : ttlNumeric;
        }
      }
    }

    const exists = !this.isExpired(key) && this.store.has(key);

    if (mode === "NX" && exists) {
      return null;
    }

    if (mode === "XX" && !exists) {
      return null;
    }

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async flushall(): Promise<"OK"> {
    this.store.clear();
    return "OK";
  }

  async quit(): Promise<"OK"> {
    return "OK";
  }
}

export type RedisClient = Pick<InMemoryRedis, "get" | "set" | "del" | "flushall" | "quit">;

export function createRedisClient(): RedisClient {
  return new InMemoryRedis();
}
