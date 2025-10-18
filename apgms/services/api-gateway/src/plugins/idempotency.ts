import { createHash } from "node:crypto";
import { Socket } from "node:net";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { FastifyPluginAsync } from "fastify";

const TARGET_POST_ROUTES = new Set(["/bank-lines", "/allocations/apply"]);
const IDEMPOTENCY_PREFIX = "idempotency:";

interface IdempotencyRecord {
  key: string;
  method: string;
  url: string;
  orgId: string;
  bodyHash: string;
  response: string;
  status: number;
  createdAt: string;
}

interface IdempotencyContext {
  key: string;
  url: string;
  orgId: string;
  bodyHash: string;
  redisKey: string;
}

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  quit?: () => Promise<unknown>;
  isOpen?: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    idempotencyContext?: IdempotencyContext;
  }
}

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

class SocketRedisClient implements RedisLike {
  private readonly host: string;
  private readonly port: number;
  private readonly password?: string;
  private socket: Socket | null = null;
  private connecting?: Promise<void>;
  private connected = false;
  private buffer = Buffer.alloc(0);
  private queue: PendingCommand[] = [];

  constructor(
    redisUrl: string,
    private readonly log: FastifyInstance["log"]
  ) {
    const parsed = new URL(redisUrl);
    this.host = parsed.hostname;
    this.port = parsed.port ? Number(parsed.port) : 6379;
    this.password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  }

  get isOpen(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    await this.ensureConnected();
  }

  async get(key: string): Promise<string | null> {
    const result = await this.sendCommand(["GET", key]);
    if (result === null || result === undefined) {
      return null;
    }
    return typeof result === "string" ? result : String(result);
  }

  async set(key: string, value: string): Promise<unknown> {
    return this.sendCommand(["SET", key, value]);
  }

  async quit(): Promise<void> {
    if (!this.connected && !this.connecting) {
      return;
    }

    try {
      await this.sendCommand(["QUIT"]);
    } catch (err) {
      this.log.error({ err }, "redis quit failed");
    } finally {
      this.destroy();
    }
  }

  private async sendCommand(args: string[]): Promise<unknown> {
    await this.ensureConnected();
    return this.dispatch(args);
  }

  private ensureConnected(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise((resolve, reject) => {
      const socket = new Socket();
      this.socket = socket;

      const handleInitialError = (err: Error) => {
        socket.removeListener("connect", handleConnect);
        this.connecting = undefined;
        this.destroy(err);
        reject(err);
      };

      const handleConnect = async () => {
        socket.removeListener("error", handleInitialError);
        socket.on("error", this.handleSocketError);
        socket.on("close", this.handleSocketClose);
        socket.on("data", this.handleSocketData);

        this.connected = true;
        this.connecting = undefined;

        try {
          if (this.password) {
            await this.dispatch(["AUTH", this.password]);
          }
          resolve();
        } catch (err) {
          const error = err instanceof Error ? err : new Error("redis auth failed");
          this.destroy(error);
          reject(error);
        }
      };

      socket.once("error", handleInitialError);
      socket.connect(this.port, this.host, handleConnect);
    });

    return this.connecting;
  }

  private dispatch(args: string[]): Promise<unknown> {
    if (!this.socket) {
      return Promise.reject(new Error("redis socket unavailable"));
    }

    const payload = this.encodeCommand(args);
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.socket!.write(payload, (err) => {
        if (err) {
          this.queue.pop();
          reject(err);
        }
      });
    });
  }

  private encodeCommand(args: string[]): Buffer {
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`*${args.length}\r\n`));
    for (const arg of args) {
      const chunk = Buffer.from(arg ?? "");
      parts.push(Buffer.from(`$${chunk.length}\r\n`));
      parts.push(chunk);
      parts.push(Buffer.from("\r\n"));
    }
    return Buffer.concat(parts);
  }

  private readonly handleSocketError = (err: Error) => {
    this.log.error({ err }, "redis socket error");
    this.destroy(err);
  };

  private readonly handleSocketClose = () => {
    this.destroy(new Error("redis connection closed"));
  };

  private readonly handleSocketData = (chunk: Buffer) => {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.queue.length) {
      const parsed = this.tryParse();
      if (!parsed) {
        break;
      }

      const { value, bytes } = parsed;
      this.buffer = this.buffer.slice(bytes);

      const pending = this.queue.shift();
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

  private tryParse(): { value: unknown; bytes: number } | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const prefix = this.buffer[0];
    const newline = this.buffer.indexOf("\r\n");
    if (newline === -1) {
      return null;
    }

    const line = this.buffer.slice(1, newline).toString();
    const bytes = newline + 2;

    if (prefix === 43 /* + */) {
      return { value: line, bytes };
    }

    if (prefix === 45 /* - */) {
      return { value: new Error(line || "redis error"), bytes };
    }

    if (prefix === 58 /* : */) {
      return { value: Number(line), bytes };
    }

    if (prefix === 36 /* $ */) {
      const length = Number(line);
      if (Number.isNaN(length)) {
        return { value: new Error("invalid bulk length"), bytes };
      }

      if (length === -1) {
        return { value: null, bytes };
      }

      const end = newline + 2 + length;
      if (this.buffer.length < end + 2) {
        return null;
      }

      const data = this.buffer.slice(newline + 2, end).toString();
      return { value: data, bytes: end + 2 };
    }

    return null;
  }

  private destroy(err?: Error) {
    if (this.socket) {
      this.socket.removeListener("error", this.handleSocketError);
      this.socket.removeListener("close", this.handleSocketClose);
      this.socket.removeListener("data", this.handleSocketData);
      this.socket.destroy();
      this.socket = null;
    }

    this.connected = false;
    this.connecting = undefined;
    this.buffer = Buffer.alloc(0);

    if (err) {
      this.rejectPending(err);
    } else {
      this.rejectPending(new Error("redis connection closed"));
    }
  }

  private rejectPending(err: Error) {
    const pending = this.queue;
    this.queue = [];
    for (const command of pending) {
      command.reject(err);
    }
  }
}

let redisPromise: Promise<SocketRedisClient> | undefined;

async function getRedisClient(fastify: FastifyInstance): Promise<SocketRedisClient> {
  if (!redisPromise) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is not configured");
    }

    const client = new SocketRedisClient(url, fastify.log);
    redisPromise = (async () => {
      await client.connect().catch(() => {});
      return client;
    })();
  }

  return redisPromise;
}

function routePath(request: FastifyRequest): string {
  const url = request.routerPath ?? request.routeOptions?.url ?? request.raw.url ?? request.url;
  return url.split("?")[0];
}

function normalizeResponsePayload(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (Buffer.isBuffer(payload)) {
    return payload.toString("utf8");
  }

  return JSON.stringify(payload);
}

function resolveOrgId(request: FastifyRequest): string {
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body.orgId === "string") {
    return body.orgId;
  }

  const headerOrg = request.headers["x-org-id"];
  if (typeof headerOrg === "string") {
    return headerOrg;
  }

  return "";
}

const idempotencyPlugin: FastifyPluginAsync<{ redisClient?: RedisLike }> = async (fastify, opts) => {
  const useExternalClient = Boolean(opts?.redisClient);
  const redis: RedisLike = opts.redisClient ?? (await getRedisClient(fastify));

  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") {
      return;
    }

    const currentPath = routePath(request);
    if (!TARGET_POST_ROUTES.has(currentPath)) {
      return;
    }

    const keyHeader = request.headers["idempotency-key"];
    if (typeof keyHeader !== "string" || keyHeader.length === 0) {
      reply.code(400).send({ error: "missing_idempotency_key" });
      return reply;
    }

    const orgId = resolveOrgId(request);
    const rawBody = request.body ?? null;
    const bodyHash = createHash("sha256").update(JSON.stringify(rawBody)).digest("hex");
    const redisKey = `${IDEMPOTENCY_PREFIX}${keyHeader}`;

    try {
      const existing = await redis.get(redisKey);
      if (existing) {
        const record = JSON.parse(existing) as IdempotencyRecord;
        if (
          record.method === request.method &&
          record.url === currentPath &&
          record.orgId === orgId &&
          record.bodyHash === bodyHash
        ) {
          reply.header("x-idempotent-replay", "true");
          reply.code(200);

          if (!record.response) {
            reply.send();
            return reply;
          }

          try {
            reply.send(JSON.parse(record.response));
            return reply;
          } catch {
            reply.send(record.response);
            return reply;
          }
        }

        reply.code(409).send({ error: "idempotency_conflict" });
        return reply;
      }
    } catch (err) {
      request.log.error({ err }, "idempotency lookup failed");
    }

    request.idempotencyContext = {
      key: keyHeader,
      url: currentPath,
      orgId,
      bodyHash,
      redisKey,
    };
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    const context = request.idempotencyContext;
    if (!context) {
      return payload;
    }

    const record: IdempotencyRecord = {
      key: context.key,
      method: request.method,
      url: context.url,
      orgId: context.orgId,
      bodyHash: context.bodyHash,
      response: normalizeResponsePayload(payload),
      status: reply.statusCode,
      createdAt: new Date().toISOString(),
    };

    try {
      await redis.set(context.redisKey, JSON.stringify(record));
    } catch (err) {
      request.log.error({ err }, "failed to persist idempotency record");
    } finally {
      delete request.idempotencyContext;
    }

    return payload;
  });

  if (!useExternalClient) {
    fastify.addHook("onClose", async () => {
      const client = await getRedisClient(fastify);
      if (client.isOpen) {
        await client.quit();
      }
    });
  }
};

export type { RedisLike as IdempotencyRedisClient };
(idempotencyPlugin as any)[Symbol.for("skip-override")] = true;
export default idempotencyPlugin;
