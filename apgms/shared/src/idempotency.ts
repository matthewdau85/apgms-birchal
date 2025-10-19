import net from "node:net";
import { URL } from "node:url";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

const redisUrlString = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
const redisUrl = new URL(redisUrlString);

type RedisReply = string | number | null | RedisReply[];

type PendingCommand = {
  resolve: (value: RedisReply) => void;
  reject: (error: Error) => void;
};

function encodeCommand(args: (string | number)[]): string {
  const parts = args.map((arg) => {
    const text = String(arg);
    return `$${Buffer.byteLength(text)}\r\n${text}\r\n`;
  });
  return `*${args.length}\r\n${parts.join("")}`;
}

function parseResp(buffer: Buffer): [RedisReply | Error, Buffer] | null {
  if (buffer.length === 0) {
    return null;
  }
  const prefix = buffer[0];
  if (prefix === 43 /* + */ || prefix === 45 /* - */) {
    const end = buffer.indexOf("\r\n");
    if (end === -1) {
      return null;
    }
    const text = buffer.slice(1, end).toString();
    const rest = buffer.slice(end + 2);
    if (prefix === 45) {
      return [new Error(text), rest];
    }
    return [text, rest];
  }
  if (prefix === 58 /* : */) {
    const end = buffer.indexOf("\r\n");
    if (end === -1) {
      return null;
    }
    const num = Number.parseInt(buffer.slice(1, end).toString(), 10);
    const rest = buffer.slice(end + 2);
    return [num, rest];
  }
  if (prefix === 36 /* $ */) {
    const end = buffer.indexOf("\r\n");
    if (end === -1) {
      return null;
    }
    const length = Number.parseInt(buffer.slice(1, end).toString(), 10);
    const start = end + 2;
    if (length === -1) {
      return [null, buffer.slice(start)];
    }
    const valueEnd = start + length;
    if (buffer.length < valueEnd + 2) {
      return null;
    }
    const value = buffer.slice(start, valueEnd).toString();
    const rest = buffer.slice(valueEnd + 2);
    return [value, rest];
  }
  if (prefix === 42 /* * */) {
    const end = buffer.indexOf("\r\n");
    if (end === -1) {
      return null;
    }
    const count = Number.parseInt(buffer.slice(1, end).toString(), 10);
    let rest = buffer.slice(end + 2);
    if (count === -1) {
      return [null, rest];
    }
    const items: RedisReply[] = [];
    for (let i = 0; i < count; i += 1) {
      const parsed = parseResp(rest);
      if (!parsed) {
        return null;
      }
      const [value, newRest] = parsed;
      if (value instanceof Error) {
        return [value, newRest];
      }
      items.push(value);
      rest = newRest;
    }
    return [items, rest];
  }
  throw new Error(`Unsupported RESP prefix: ${String.fromCharCode(prefix)}`);
}

class SimpleRedisClient {
  private socket: net.Socket | null = null;

  private buffer = Buffer.alloc(0);

  private readonly pending: PendingCommand[] = [];

  private connectPromise: Promise<void> | null = null;

  private closing = false;

  constructor(private readonly url: URL) {}

  private async ensureConnection(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }
    if (!this.connectPromise) {
      this.connectPromise = new Promise((resolve, reject) => {
        const socket = net.createConnection(
          { host: this.url.hostname, port: Number(this.url.port || 6379) },
          async () => {
            this.socket = socket;
            this.socket.on("data", this.handleData);
            this.socket.on("error", this.handleSocketError);
            this.socket.on("close", this.handleSocketClose);
            try {
              if (this.url.password) {
                await this.sendCommandInternal(["AUTH", this.url.password]);
              }
              resolve();
            } catch (error) {
              this.cleanup();
              reject(error as Error);
            }
          },
        );
        socket.once("error", (err) => {
          if (!this.socket) {
            reject(err);
          }
        });
      }).finally(() => {
        this.connectPromise = null;
      });
    }
    return this.connectPromise;
  }

  private handleData = (chunk: Buffer) => {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.pending.length) {
      const parsed = parseResp(this.buffer);
      if (!parsed) {
        break;
      }
      const [value, rest] = parsed;
      this.buffer = rest;
      const pending = this.pending.shift();
      if (!pending) {
        continue;
      }
      if (value instanceof Error) {
        pending.reject(value);
      } else {
        pending.resolve(value);
      }
    }
  };

  private handleSocketError = (err: Error) => {
    while (this.pending.length) {
      this.pending.shift()?.reject(err);
    }
    this.cleanup();
  };

  private handleSocketClose = () => {
    if (!this.closing) {
      this.cleanup();
    }
  };

  private cleanup() {
    this.socket?.removeListener("data", this.handleData);
    this.socket?.removeListener("error", this.handleSocketError);
    this.socket?.removeListener("close", this.handleSocketClose);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
  }

  private sendCommandInternal(args: (string | number)[]): Promise<RedisReply> {
    if (!this.socket) {
      throw new Error("Redis socket is not connected");
    }
    return new Promise<RedisReply>((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket!.write(encodeCommand(args));
    });
  }

  async command(args: (string | number)[]): Promise<RedisReply> {
    await this.ensureConnection();
    return this.sendCommandInternal(args);
  }

  async get(key: string): Promise<string | null> {
    const result = await this.command(["GET", key]);
    if (result === null) {
      return null;
    }
    if (typeof result === "string") {
      return result;
    }
    throw new Error("Unexpected response for GET");
  }

  async set(
    key: string,
    value: string,
    options?: { nx?: boolean; ex?: number },
  ): Promise<string | null> {
    const args: (string | number)[] = ["SET", key, value];
    if (options?.nx) {
      args.push("NX");
    }
    if (typeof options?.ex === "number") {
      args.push("EX", options.ex);
    }
    const result = await this.command(args);
    if (result === null) {
      return null;
    }
    if (typeof result === "string") {
      return result;
    }
    throw new Error("Unexpected response for SET");
  }

  async del(key: string): Promise<number> {
    const result = await this.command(["DEL", key]);
    if (typeof result === "number") {
      return result;
    }
    throw new Error("Unexpected response for DEL");
  }

  async flushdb(): Promise<void> {
    await this.command(["FLUSHDB"]);
  }

  async quit(): Promise<void> {
    if (!this.socket || this.socket.destroyed) {
      return;
    }
    this.closing = true;
    try {
      await this.command(["QUIT"]);
    } catch {
      // ignore errors during shutdown
    } finally {
      this.socket?.end();
      this.cleanup();
      this.closing = false;
    }
  }
}

export const idempotencyRedis = new SimpleRedisClient(redisUrl);

const IDEMPOTENCY_NAMESPACE = "idempotency";

export class IdempotencyInProgressError extends Error {
  constructor(message = "An idempotent request with the same key is already in progress") {
    super(message);
    this.name = "IdempotencyInProgressError";
  }
}

type PendingRecord = { status: "pending" };
type CompletedRecord<T> = { status: "completed"; result: T };
type StoredRecord<T> = PendingRecord | CompletedRecord<T>;

export interface IdempotencyOptions {
  ttlSeconds?: number;
  pendingTtlSeconds?: number;
}

export interface IdempotencyResult<T> {
  reused: boolean;
  value: T;
}

function redisKeyFromId(key: string): string {
  return `${IDEMPOTENCY_NAMESPACE}:${key}`;
}

export async function withIdempotency<T>(
  key: string,
  handler: () => Promise<T>,
  options: IdempotencyOptions = {},
): Promise<IdempotencyResult<T>> {
  const redisKey = redisKeyFromId(key);
  const pendingTtlSeconds = options.pendingTtlSeconds ?? 30;
  const ttlSeconds = options.ttlSeconds ?? 60 * 10;

  const placeholder: PendingRecord = { status: "pending" };
  const created = await idempotencyRedis.set(redisKey, JSON.stringify(placeholder), {
    nx: true,
    ex: pendingTtlSeconds,
  });

  if (!created) {
    const existingRaw = await idempotencyRedis.get(redisKey);
    if (!existingRaw) {
      throw new IdempotencyInProgressError();
    }
    const existing = JSON.parse(existingRaw) as StoredRecord<T>;
    if (existing.status === "completed") {
      return { reused: true, value: existing.result };
    }
    throw new IdempotencyInProgressError();
  }

  try {
    const value = await handler();
    const record: CompletedRecord<T> = { status: "completed", result: value };
    await idempotencyRedis.set(redisKey, JSON.stringify(record), { ex: ttlSeconds });
    return { reused: false, value };
  } catch (error) {
    await idempotencyRedis.del(redisKey);
    throw error;
  }
}

export async function clearIdempotencyKey(key: string): Promise<void> {
  await idempotencyRedis.del(redisKeyFromId(key));
}

export async function shutdownIdempotency(): Promise<void> {
  await idempotencyRedis.quit();
}
