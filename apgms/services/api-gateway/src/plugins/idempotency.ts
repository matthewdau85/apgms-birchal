import crypto from "node:crypto";
import { Readable } from "node:stream";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h
const HEADER_ALLOWLIST = ["content-type", "cache-control", "etag", "location"]; // subset to replay

type StoredBody =
  | { type: "string"; value: string }
  | { type: "buffer"; value: string };

interface CacheEntry {
  bodyHash: string;
  statusCode: number;
  headers: Record<string, string>;
  body: StoredBody;
}

interface IdempotencyStore {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, value: CacheEntry, ttlSeconds: number): Promise<void>;
  disconnect?(): Promise<void> | void;
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
    idempotencyContext?: {
      cacheKey: string;
      bodyHash: string;
      fromCache: boolean;
    };
  }
}

class MemoryStore implements IdempotencyStore {
  private readonly store = new Map<string, { entry: CacheEntry; expiresAt: number }>();

  async get(key: string): Promise<CacheEntry | null> {
    const record = this.store.get(key);
    if (!record) {
      return null;
    }
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return record.entry;
  }

  async set(key: string, value: CacheEntry, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { entry: { ...value, headers: { ...value.headers }, body: { ...value.body } }, expiresAt });
  }
}

interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttl: number): Promise<unknown>;
  quit(): Promise<unknown>;
}

class RedisStore implements IdempotencyStore {
  constructor(private readonly client: RedisLikeClient) {}

  async get(key: string): Promise<CacheEntry | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CacheEntry;
  }

  async set(key: string, value: CacheEntry, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

async function createStore(app: FastifyInstance): Promise<IdempotencyStore> {
  if (process.env.REDIS_URL) {
    try {
      const module = await import("ioredis");
      const RedisCtor = module.default as unknown as {
        new (url: string): RedisLikeClient;
      };
      const client = new RedisCtor(process.env.REDIS_URL);
      return new RedisStore(client);
    } catch (err) {
      app.log.warn({ err }, "failed to initialize redis client, using in-memory store");
    }
  }
  return new MemoryStore();
}

function extractOrgId(req: FastifyRequest): string | null {
  const headerValue = req.headers["x-org-id"]; // allow override via header
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue;
  }
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body.orgId === "string" && body.orgId.trim().length > 0) {
    return body.orgId;
  }
  if (body && typeof body.orgId === "number") {
    return String(body.orgId);
  }
  return null;
}

function computeBodyHash(rawBody: Buffer | undefined): string {
  const buffer = rawBody ?? Buffer.alloc(0);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function serializeBody(payload: unknown): StoredBody {
  if (Buffer.isBuffer(payload)) {
    return { type: "buffer", value: payload.toString("base64") };
  }
  if (payload === undefined) {
    return { type: "string", value: "" };
  }
  if (payload === null) {
    return { type: "string", value: "null" };
  }
  return { type: "string", value: typeof payload === "string" ? payload : JSON.stringify(payload) };
}

function deserializeBody(body: StoredBody): string | Buffer {
  if (body.type === "buffer") {
    return Buffer.from(body.value, "base64");
  }
  return body.value;
}

function pickHeaders(reply: FastifyReply): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of HEADER_ALLOWLIST) {
    const value = reply.getHeader(name);
    if (value !== undefined && value !== null) {
      headers[name] = Array.isArray(value) ? value.join(",") : String(value);
    }
  }
  return headers;
}

const idempotencyPlugin: FastifyPluginAsync = async (app) => {
  const store = await createStore(app);

  if ("disconnect" in store && typeof store.disconnect === "function") {
    app.addHook("onClose", async () => {
      await store.disconnect?.();
    });
  }

  if (!app.hasRequestDecorator("rawBody")) {
    app.decorateRequest("rawBody", null);
  }
  if (!app.hasRequestDecorator("idempotencyContext")) {
    app.decorateRequest("idempotencyContext", null);
  }

  app.addHook("preParsing", (req, _reply, payload, done) => {
    if (req.method !== "POST") {
      req.rawBody = Buffer.alloc(0);
      return done(null, payload);
    }

    if (!payload) {
      req.rawBody = Buffer.alloc(0);
      return done(null, payload);
    }

    if (typeof payload === "string" || Buffer.isBuffer(payload)) {
      const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      req.rawBody = buffer;
      return done(null, Readable.from(buffer));
    }

    const chunks: Buffer[] = [];
    let completed = false;
    payload.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    payload.on("error", (err) => {
      if (completed) return;
      completed = true;
      done(err, null);
    });
    payload.on("end", () => {
      if (completed) return;
      completed = true;
      const rawBody = Buffer.concat(chunks);
      req.rawBody = rawBody;
      done(null, Readable.from(rawBody));
    });
  });

  app.addHook("preHandler", async (req, reply) => {
    if (req.method !== "POST" || !(req.routeOptions.config as any)?.idempotency) {
      return;
    }

    const idempotencyKeyHeader = req.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(idempotencyKeyHeader)
      ? idempotencyKeyHeader[0]
      : idempotencyKeyHeader;

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      reply.code(400);
      await reply.send({ error: "missing_idempotency_key" });
      return reply;
    }

    const orgId = extractOrgId(req);
    if (!orgId) {
      reply.code(400);
      await reply.send({ error: "missing_org_id" });
      return reply;
    }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const bodyHash = computeBodyHash(rawBody);
    const cacheKey = `${req.method}:${req.url}:${orgId}:${idempotencyKey}`;

    req.idempotencyContext = {
      cacheKey,
      bodyHash,
      fromCache: false,
    };

    const cached = await store.get(cacheKey);
    if (!cached) {
      return;
    }

    if (cached.bodyHash !== bodyHash) {
      reply.code(409);
      await reply.send({ error: "idempotency_body_mismatch" });
      return reply;
    }

    req.idempotencyContext.fromCache = true;

    reply.code(cached.statusCode);
    for (const [name, value] of Object.entries(cached.headers)) {
      reply.header(name, value);
    }
    await reply.send(deserializeBody(cached.body));
    return reply;
  });

  app.addHook("onSend", async (req, reply, payload) => {
    if (
      req.method !== "POST" ||
      !(req.routeOptions.config as any)?.idempotency ||
      !req.idempotencyContext ||
      req.idempotencyContext.fromCache
    ) {
      return payload;
    }

    if (reply.statusCode < 200 || reply.statusCode >= 300) {
      return payload;
    }

    const headers = pickHeaders(reply);
    const body = serializeBody(payload);
    const entry: CacheEntry = {
      bodyHash: req.idempotencyContext.bodyHash,
      statusCode: reply.statusCode,
      headers,
      body,
    };

    await store.set(req.idempotencyContext.cacheKey, entry, IDEMPOTENCY_TTL_SECONDS);

    return payload;
  });
};

export default idempotencyPlugin;
