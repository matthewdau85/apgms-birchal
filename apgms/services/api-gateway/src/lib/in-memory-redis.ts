import type { IdempotencyStore } from "../plugins/idempotency";

type StoredValue = {
  value: string;
  expiresAt?: number;
};

export default class InMemoryRedis implements IdempotencyStore {
  private store = new Map<string, StoredValue>();
  private timeouts = new Map<string, NodeJS.Timeout>();

  async get(key: string): Promise<string | null> {
    const current = this.store.get(key);
    if (!current) {
      return null;
    }
    if (typeof current.expiresAt === "number" && current.expiresAt <= Date.now()) {
      await this.del(key);
      return null;
    }
    return current.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<void> {
    if (mode === "EX" && typeof duration === "number" && duration > 0) {
      const expiresAt = Date.now() + duration * 1000;
      this.store.set(key, { value, expiresAt });
      this.resetTimeout(key, expiresAt);
      return;
    }
    this.clearTimeout(key);
    this.store.set(key, { value });
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key) ? 1 : 0;
    this.clearTimeout(key);
    return existed;
  }

  async flushall(): Promise<void> {
    this.store.clear();
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }

  async quit(): Promise<void> {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }

  private resetTimeout(key: string, expiresAt: number) {
    this.clearTimeout(key);
    const delay = Math.max(expiresAt - Date.now(), 0);
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.timeouts.delete(key);
    }, delay);
    if (typeof (timeout as any).unref === "function") {
      (timeout as any).unref();
    }
    this.timeouts.set(key, timeout as unknown as NodeJS.Timeout);
  }

  private clearTimeout(key: string) {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout as unknown as NodeJS.Timeout);
      this.timeouts.delete(key);
    }
  }
}
