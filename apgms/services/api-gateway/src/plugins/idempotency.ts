import crypto from "node:crypto";
import net from "node:net";
import { URL } from "node:url";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  quit(): Promise<unknown>;
}

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt?: number }>();

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

  async set(key: string, value: string, mode?: "EX", ttlSeconds?: number): Promise<string> {
    let expiresAt: number | undefined;
    if (mode === "EX" && typeof ttlSeconds === "number") {
      expiresAt = Date.now() + ttlSeconds * 1000;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async quit(): Promise<void> {
    this.store.clear();
  }
}

class SocketRedis implements RedisLike {
  private socket: net.Socket;
  private buffer = Buffer.alloc(0);
  private queue: Array<{ resolve: (value: unknown) => void; reject: (err: Error) => void }> = [];
  private ready: Promise<void>;
  private ended = false;

  constructor(redisUrl: string) {
    const url = new URL(redisUrl);
    const port = Number(url.port || 6379);
    const host = url.hostname || "127.0.0.1";
    const password = url.password ? decodeURIComponent(url.password) : undefined;

    this.socket = net.createConnection({ host, port });
    this.socket.on("data", (chunk) => this.onData(chunk));
    this.socket.on("error", (err) => this.flushError(err));
    this.socket.on("end", () => this.flushError(new Error("redis connection ended")));

    this.ready = new Promise((resolve, reject) => {
      const handleError = (err: Error) => {
        this.socket.removeListener("connect", handleConnect);
        reject(err);
      };

      const handleConnect = async () => {
        this.socket.removeListener("error", handleError);
        try {
          if (password) {
            await this.sendCommand(["AUTH", password], true);
          }
          resolve();
        } catch (err) {
          reject(err as Error);
        }
      };

      this.socket.once("error", handleError);
      this.socket.once("connect", handleConnect);
    });
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.processBuffer();
  }

  private processBuffer(): void {
    while (true) {
      const result = this.parseResponse();
      if (result === undefined) {
        break;
      }
      const pending = this.queue.shift();
      if (!pending) {
        continue;
      }
      if (result instanceof Error) {
        pending.reject(result);
      } else {
        pending.resolve(result);
      }
    }
  }

  private parseResponse(): unknown {
    if (this.buffer.length === 0) {
      return undefined;
    }
    const prefix = String.fromCharCode(this.buffer[0]);
    if (prefix === "+" || prefix === "-") {
      const end = this.buffer.indexOf("\r\n");
      if (end === -1) {
        return undefined;
      }
      const payload = this.buffer.slice(1, end).toString();
      this.buffer = this.buffer.slice(end + 2);
      if (prefix === "-") {
        return new Error(payload);
      }
      return payload;
    }

    if (prefix === "$") {
      const end = this.buffer.indexOf("\r\n");
      if (end === -1) {
        return undefined;
      }
      const length = Number(this.buffer.slice(1, end).toString());
      if (length === -1) {
        this.buffer = this.buffer.slice(end + 2);
        return null;
      }
      const total = end + 2 + length + 2;
      if (this.buffer.length < total) {
        return undefined;
      }
      const value = this.buffer.slice(end + 2, end + 2 + length).toString();
      this.buffer = this.buffer.slice(total);
      return value;
    }

    if (prefix === ":") {
      const end = this.buffer.indexOf("\r\n");
      if (end === -1) {
        return undefined;
      }
      const numberValue = Number(this.buffer.slice(1, end).toString());
      this.buffer = this.buffer.slice(end + 2);
      return numberValue;
    }

    if (prefix === "*") {
      const end = this.buffer.indexOf("\r\n");
      if (end === -1) {
        return undefined;
      }
      const count = Number(this.buffer.slice(1, end).toString());
      this.buffer = this.buffer.slice(end + 2);
      const values: unknown[] = [];
      for (let i = 0; i < count; i += 1) {
        const value = this.parseResponse();
        if (value === undefined) {
          return undefined;
        }
        values.push(value);
      }
      return values;
    }

    return undefined;
  }

  private flushError(err: Error): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    while (this.queue.length) {
      this.queue.shift()?.reject(err);
    }
  }

  private sendCommand(args: string[], skipReady = false): Promise<unknown> {
    const command = `*${args.length}\r\n${args
      .map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`)
      .join("")}`;

    return new Promise(async (resolve, reject) => {
      try {
        if (!skipReady) {
          await this.ensureReady();
        }

        this.queue.push({ resolve, reject });
        this.socket.write(command, (err) => {
          if (err) {
            this.queue.pop()?.reject(err);
            reject(err);
          }
        });
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  async get(key: string): Promise<string | null> {
    const result = await this.sendCommand(["GET", key]);
    if (result === null || result === undefined) {
      return null;
    }
    return String(result);
  }

  async set(key: string, value: string, mode?: "EX", ttlSeconds?: number): Promise<string> {
    const args = ["SET", key, value];
    if (mode === "EX" && typeof ttlSeconds === "number") {
      args.push("EX", String(ttlSeconds));
    }
    const result = await this.sendCommand(args);
    return typeof result === "string" ? result : "OK";
  }

  async quit(): Promise<void> {
    try {
      await this.sendCommand(["QUIT"]);
    } catch (err) {
      // ignore quit failures
    } finally {
      this.socket.destroy();
    }
  }
}

interface IdempotencyPluginOptions {
  paths: string[];
  redisUrl?: string;
  ttlSeconds?: number;
}

interface CacheRecord {
  key: string;
  method: string;
  url: string;
  orgId?: string;
  bodyHash: string;
  response: unknown;
  status: number;
}

async function createRedisClient(redisUrl: string): Promise<RedisLike> {
  if (redisUrl.startsWith("redis://mock")) {
    return new InMemoryRedis();
  }
  return new SocketRedis(redisUrl);
}

function resolveRoutePath(request: FastifyRequest): string {
  if (request.routerPath) {
    return request.routerPath;
  }
  const rawUrl = request.raw.url ?? request.url;
  return rawUrl.split("?")[0] ?? rawUrl;
}

function normaliseBody(body: unknown): string {
  if (typeof body === "string") {
    return body;
  }
  if (Buffer.isBuffer(body)) {
    return body.toString("utf8");
  }
  return JSON.stringify(body ?? null);
}

function extractOrgId(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  const value = (body as Record<string, unknown>).orgId;
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

const idempotencyPlugin: FastifyPluginAsync<IdempotencyPluginOptions> = async (app, opts) => {
  const trackedPaths = new Set(opts.paths);
  if (trackedPaths.size === 0) {
    app.log.warn("idempotency plugin registered with no tracked paths");
    return;
  }

  const redisUrl = opts.redisUrl ?? process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL must be configured for idempotency middleware");
  }

  const redis = await createRedisClient(redisUrl);

  app.addHook("onClose", async () => {
    await redis.quit();
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") {
      return;
    }

    const routePath = resolveRoutePath(request);
    if (!trackedPaths.has(routePath)) {
      return;
    }

    const keyHeader = request.headers["idempotency-key"];
    if (typeof keyHeader !== "string" || keyHeader.trim() === "") {
      reply.code(400);
      return reply.send({ error: "idempotency_key_required" });
    }

    const idempotencyKey = keyHeader.trim();
    const cacheKey = `idempotency:${idempotencyKey}`;
    const bodyContent = normaliseBody(request.body);
    const bodyHash = crypto.createHash("sha256").update(bodyContent).digest("hex");
    const orgId = extractOrgId(request.body);

    const cachedRaw = await redis.get(cacheKey);
    if (cachedRaw) {
      let cached: CacheRecord | undefined;
      try {
        cached = JSON.parse(cachedRaw) as CacheRecord;
      } catch (err) {
        request.log.warn({ err }, "invalid cache payload, discarding");
      }

      if (cached) {
        const isMatch =
          cached.method === request.method &&
          cached.url === routePath &&
          cached.bodyHash === bodyHash &&
          cached.orgId === orgId;

        if (isMatch) {
          reply.header("idempotency-replay", "true");
          reply.header("idempotency-original-status", String(cached.status));
          reply.code(200);
          return reply.send(cached.response);
        }

        reply.code(409);
        return reply.send({ error: "idempotency_key_conflict" });
      }
    }

    const originalSend = reply.send.bind(reply);

    reply.send = async function patchedSend(this: FastifyReply, payload: unknown) {
      const record: CacheRecord = {
        key: idempotencyKey,
        method: request.method,
        url: routePath,
        orgId,
        bodyHash,
        response: payload,
        status: this.statusCode,
      };

      const ttlSeconds = opts.ttlSeconds;
      const serialised = JSON.stringify(record);
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await redis.set(cacheKey, serialised, "EX", ttlSeconds);
        } else {
          await redis.set(cacheKey, serialised);
        }
      } catch (err) {
        request.log.error({ err }, "failed to persist idempotency record");
      }

      return await originalSend(payload);
    };
  });
};

const pluginMeta = idempotencyPlugin as unknown as Record<symbol, unknown>;
pluginMeta[Symbol.for("skip-override")] = true;
pluginMeta[Symbol.for("fastify.display-name")] = "idempotency-plugin";

export default idempotencyPlugin;
