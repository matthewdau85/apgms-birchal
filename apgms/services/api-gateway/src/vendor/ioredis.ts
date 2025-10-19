import { setTimeout as sleep } from "node:timers/promises";

type StoredValue = {
  value: string;
  expiresAt?: number;
};

export default class Redis {
  #store = new Map<string, StoredValue>();
  status: "end" | "ready" | "connecting" = "end";

  constructor(public readonly url: string | undefined = undefined) {}

  async connect(): Promise<void> {
    this.status = "ready";
  }

  async quit(): Promise<void> {
    this.status = "end";
  }

  async get(key: string): Promise<string | null> {
    const entry = this.#store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.#store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    mode?: "NX" | "XX",
    expiryMode?: "EX" | "PX",
    duration?: number,
  ): Promise<"OK" | null> {
    if (mode === "NX" && (await this.#hasLiveKey(key))) {
      return null;
    }
    if (mode === "XX" && !(await this.#hasLiveKey(key))) {
      return null;
    }
    const expiresAt = this.#resolveExpiry(expiryMode, duration);
    this.#store.set(key, { value, expiresAt });
    return "OK";
  }

  async setex(key: string, seconds: number, value: string): Promise<"OK"> {
    await this.set(key, value, undefined, "EX", seconds);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.#store.delete(key)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  async exists(key: string): Promise<number> {
    return (await this.#hasLiveKey(key)) ? 1 : 0;
  }

  duplicate(): Redis {
    const clone = new Redis(this.url);
    clone.#store = this.#store;
    return clone;
  }

  async waitForReady(): Promise<void> {
    while (this.status !== "ready") {
      await sleep(5);
    }
  }

  #resolveExpiry(mode?: "EX" | "PX", duration?: number): number | undefined {
    if (!mode || !duration) {
      return undefined;
    }
    const ttlMs = mode === "EX" ? duration * 1000 : duration;
    return Date.now() + ttlMs;
  }

  async #hasLiveKey(key: string): Promise<boolean> {
    const entry = this.#store.get(key);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.#store.delete(key);
      return false;
    }
    return true;
  }
}
