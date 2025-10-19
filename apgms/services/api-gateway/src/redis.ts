interface StoredValue {
  value: string;
  expiresAt?: number;
}

class InMemoryRedis {
  private store = new Map<string, StoredValue>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: string, ex?: string, ttlSeconds?: number): Promise<"OK" | null> {
    if (mode === "NX") {
      const existing = await this.get(key);
      if (existing !== null) {
        return null;
      }
    }
    const expiresAt = ex === "EX" && typeof ttlSeconds === "number" ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async flushall(): Promise<void> {
    this.store.clear();
  }
}

export const redis = new InMemoryRedis();

export const IDEMPOTENCY_PREFIX = "idempotency:";
export const NONCE_PREFIX = "webhook:nonce:";
