type RedisValue = string;

type ListStore = Map<string, RedisValue[]>;

class InMemoryRedisClient {
  private readonly lists: ListStore = new Map();

  async rpush(key: string, ...values: RedisValue[]): Promise<number> {
    const current = this.lists.get(key) ?? [];
    current.push(...values);
    this.lists.set(key, current);
    return current.length;
  }

  async lpop(key: string): Promise<RedisValue | null> {
    const current = this.lists.get(key);
    if (!current?.length) {
      return null;
    }
    const value = current.shift() ?? null;
    if (!current.length) {
      this.lists.delete(key);
    }
    return value;
  }

  async llen(key: string): Promise<number> {
    return this.lists.get(key)?.length ?? 0;
  }

  async del(key: string): Promise<void> {
    this.lists.delete(key);
  }

  async quit(): Promise<void> {
    return Promise.resolve();
  }

  snapshot(): Record<string, RedisValue[]> {
    return Object.fromEntries(this.lists.entries());
  }
}

let client: InMemoryRedisClient | undefined;

export function getRedisClient(): InMemoryRedisClient {
  if (!client) {
    if (!process.env.REDIS_URL) {
      process.env.REDIS_URL = "redis://localhost:6379";
    }
    client = new InMemoryRedisClient();
  }
  return client;
}

export function resetRedis(): void {
  client = undefined;
}

export type RedisClient = InMemoryRedisClient;
