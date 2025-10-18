declare module "ioredis" {
  export default class Redis {
    constructor(connection?: string);
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
    del(key: string): Promise<number>;
    quit(): Promise<void>;
    flushall?(): Promise<void>;
  }
}
