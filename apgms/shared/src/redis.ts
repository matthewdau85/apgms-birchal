interface SetOptions {
  NX?: boolean;
  XX?: boolean;
  PX?: number;
}

interface StoredValue {
  value: string;
  expiresAt: number | null;
}

class InMemoryRedis {
  private readonly store = new Map<string, StoredValue>();

  private cleanup(key: string): void {
    const item = this.store.get(key);
    if (!item) return;
    if (item.expiresAt !== null && item.expiresAt <= Date.now()) {
      this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanup(key);
    const item = this.store.get(key);
    return item ? item.value : null;
  }

  async set(key: string, value: string, options: SetOptions = {}): Promise<"OK" | null> {
    this.cleanup(key);
    const exists = this.store.has(key);

    if (options.NX && exists) {
      return null;
    }

    if (options.XX && !exists) {
      return null;
    }

    const expiresAt = options.PX != null ? Date.now() + options.PX : null;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    this.cleanup(key);
    return this.store.delete(key) ? 1 : 0;
  }
}

export const redis = new InMemoryRedis();
export type { SetOptions };
