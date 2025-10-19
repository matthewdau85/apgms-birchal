export default class Redis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  constructor(public url: string = "redis://127.0.0.1:6379") {}

  private purgeIfExpired(key: string) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.purgeIfExpired(key);
    return entry ? entry.value : null;
  }

  async set(
    key: string,
    value: string,
    mode?: "NX" | "XX",
    expiry?: "EX",
    ttlSeconds?: number,
  ): Promise<"OK" | null> {
    const existing = await this.get(key);
    if (mode === "NX" && existing !== null) {
      return null;
    }
    if (mode === "XX" && existing === null) {
      return null;
    }

    let expiresAt: number | undefined;
    if (expiry === "EX" && typeof ttlSeconds === "number") {
      expiresAt = Date.now() + ttlSeconds * 1000;
    }

    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async quit(): Promise<void> {}
}
