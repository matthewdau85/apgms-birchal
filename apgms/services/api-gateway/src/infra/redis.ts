export type RedisSetReturn = "OK" | null;

interface StoreValue {
  value: string;
  timeout?: NodeJS.Timeout;
}

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<RedisSetReturn>;
  quit(): Promise<void>;
  flushall(): Promise<void>;
}

const parseTtl = (value: string | number | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
};

export class InMemoryRedis implements RedisClient {
  private store = new Map<string, StoreValue>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<RedisSetReturn> {
    let nx = false;
    let ttl: number | undefined;

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (typeof arg === "string") {
        const upper = arg.toUpperCase();
        if (upper === "NX") {
          nx = true;
        } else if (upper === "EX") {
          ttl = parseTtl(args[i + 1]);
          i += 1;
        }
      }
    }

    if (nx && this.store.has(key)) {
      return null;
    }

    const existing = this.store.get(key);
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }

    const entry: StoreValue = { value };
    if (ttl) {
      entry.timeout = setTimeout(() => {
        this.store.delete(key);
      }, ttl * 1000);
    }

    this.store.set(key, entry);
    return "OK";
  }

  async quit(): Promise<void> {
    for (const entry of this.store.values()) {
      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }
    }
    this.store.clear();
  }

  async flushall(): Promise<void> {
    await this.quit();
  }
}

export const createRedisClient = () => new InMemoryRedis();
