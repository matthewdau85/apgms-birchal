declare module "ioredis" {
  export default class Redis {
    constructor(url: string, options?: Record<string, unknown>);
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
  }
}
