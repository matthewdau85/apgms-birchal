import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const NONCE_TTL_SECONDS = Math.ceil(FIVE_MINUTES_MS / 1000);

export type VerificationResult =
  | { ok: true }
  | {
      ok: false;
      statusCode: number;
      error:
        | "missing_signature"
        | "timestamp_expired"
        | "replay_detected"
        | "invalid_signature"
        | "secret_not_configured";
    };

type RequestWithRawBody = FastifyRequest & { rawBody?: Buffer | string };

export interface NonceStore {
  has(nonce: string): Promise<boolean>;
  set(nonce: string, ttlSeconds: number): Promise<void>;
}

let configuredStore: NonceStore | null = null;
let redisStorePromise: Promise<NonceStore | null> | null = null;

function nonceKey(nonce: string): string {
  return `webhook:nonce:${nonce}`;
}

const memoryNonces = new Map<string, number>();

const memoryStore: NonceStore = {
  async has(nonce) {
    const entry = memoryNonces.get(nonce);
    if (!entry) {
      return false;
    }
    if (entry <= Date.now()) {
      memoryNonces.delete(nonce);
      return false;
    }
    return true;
  },
  async set(nonce, ttlSeconds) {
    memoryNonces.set(nonce, Date.now() + ttlSeconds * 1000);
  },
};

async function loadRedisStore(): Promise<NonceStore | null> {
  if (!redisStorePromise) {
    redisStorePromise = (async () => {
      try {
        const { createClient } = await import("redis");
        const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
        const client = createClient({ url });
        client.on("error", (err: unknown) => {
          console.error({ err }, "redis connection error");
        });
        await client.connect();
        const store: NonceStore = {
          async has(nonce) {
            const exists = await client.exists(nonceKey(nonce));
            return exists === 1;
          },
          async set(nonce, ttlSeconds) {
            await client.set(nonceKey(nonce), "1", { EX: ttlSeconds });
          },
        };
        return store;
      } catch (err) {
        console.warn({ err }, "falling back to in-memory nonce store");
        return null;
      }
    })();
  }

  return redisStorePromise;
}

async function getNonceStore(): Promise<NonceStore> {
  if (configuredStore) {
    return configuredStore;
  }
  const redisBacked = await loadRedisStore();
  if (redisBacked) {
    return redisBacked;
  }
  return memoryStore;
}

export function setNonceStore(store: NonceStore | null): void {
  configuredStore = store;
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function getRawBodyString(rawBody: Buffer | string | undefined): string {
  if (!rawBody) {
    return "";
  }
  if (typeof rawBody === "string") {
    return rawBody;
  }
  return rawBody.toString("utf8");
}

export async function verifySignature(req: RequestWithRawBody): Promise<VerificationResult> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, statusCode: 500, error: "secret_not_configured" };
  }

  const signature = normalizeHeader(req.headers["x-signature"]);
  const timestamp = normalizeHeader(req.headers["x-timestamp"]);
  const nonce = normalizeHeader(req.headers["x-nonce"]);

  if (!signature || !timestamp || !nonce) {
    return { ok: false, statusCode: 401, error: "missing_signature" };
  }

  const timestampMs = Date.parse(timestamp);
  if (Number.isNaN(timestampMs) || Date.now() - timestampMs > FIVE_MINUTES_MS) {
    return { ok: false, statusCode: 401, error: "timestamp_expired" };
  }

  const store = await getNonceStore();
  if (await store.has(nonce)) {
    return { ok: false, statusCode: 409, error: "replay_detected" };
  }

  const rawBody = getRawBodyString(req.rawBody);
  const data = `${timestamp}.${nonce}.${rawBody}`;

  const computed = createHmac("sha256", secret).update(data).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return { ok: false, statusCode: 401, error: "invalid_signature" };
  }

  if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
    return { ok: false, statusCode: 401, error: "invalid_signature" };
  }

  await store.set(nonce, NONCE_TTL_SECONDS);
  return { ok: true };
}

