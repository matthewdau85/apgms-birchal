import crypto from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { createClient, type RedisClientType } from "redis";

type RedisLike = Pick<RedisClientType, "set"> & {
  connect?: () => Promise<void>;
  quit?: () => Promise<void>;
};

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }

  interface FastifyInstance {
    verifyWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export interface WebhookPluginOptions {
  redisClient?: RedisLike;
}

const NONCE_TTL_SECONDS = 60 * 60 * 24;

async function ensureRedisConnection(client: RedisLike) {
  if (typeof client.connect === "function") {
    try {
      await client.connect();
    } catch (err: unknown) {
      if ((err as { code?: string })?.code !== "ERR_SOCKET_ALREADY_CONNECTED") {
        throw err;
      }
    }
  }
}

async function releaseRedis(client: RedisLike) {
  if (typeof client.quit === "function") {
    await client.quit().catch(() => undefined);
  }
}

function timingSafeCompare(expected: Buffer, receivedHex: string): boolean {
  if (!/^[0-9a-f]+$/i.test(receivedHex) || receivedHex.length % 2 !== 0) {
    return false;
  }
  const received = Buffer.from(receivedHex, "hex");
  if (received.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(received, expected);
}

const webhookPlugin: FastifyPluginAsync<WebhookPluginOptions> = async (
  app,
  opts = {},
) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("WEBHOOK_SECRET is not configured");
  }

  const skewSeconds = Number(process.env.WEBHOOK_TS_SKEW_SEC ?? "300");
  const allowedSkewMs = Number.isFinite(skewSeconds) && skewSeconds > 0
    ? skewSeconds * 1000
    : 300_000;

  const redisClient =
    opts.redisClient ??
    createClient({ url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379" });

  await ensureRedisConnection(redisClient);

  app.addHook("onClose", async () => {
    if (!opts.redisClient) {
      await releaseRedis(redisClient);
    }
  });

  app.decorate(
    "verifyWebhook",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers["x-signature"];
      const nonce = request.headers["x-nonce"];
      const timestampHeader = request.headers["x-timestamp"];

      if (
        typeof signature !== "string" ||
        typeof nonce !== "string" ||
        typeof timestampHeader !== "string"
      ) {
        await reply.code(401).send({ error: "unauthorized" });
        return;
      }

      const timestamp = Date.parse(timestampHeader);
      if (Number.isNaN(timestamp)) {
        await reply.code(401).send({ error: "invalid_timestamp" });
        return;
      }

      const now = Date.now();
      if (Math.abs(now - timestamp) > allowedSkewMs) {
        await reply.code(409).send({ error: "stale_timestamp" });
        return;
      }

      const rawBody = request.rawBody ?? "";
      const payload = `${timestampHeader}.${nonce}.${rawBody}`;
      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest();

      if (!timingSafeCompare(expected, signature)) {
        await reply.code(401).send({ error: "invalid_signature" });
        return;
      }

      const nonceKey = `nonce:${nonce}`;
      const stored = await redisClient.set(nonceKey, "1", {
        NX: true,
        EX: NONCE_TTL_SECONDS,
      });

      if (stored === null) {
        await reply.code(409).send({ error: "nonce_reused" });
        return;
      }
    },
  );
};

export default webhookPlugin;
