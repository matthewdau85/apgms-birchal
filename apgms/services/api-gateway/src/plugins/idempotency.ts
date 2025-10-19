import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { redis, IDEMPOTENCY_PREFIX } from "../redis";

const REPLAY_HEADER = "x-idempotent-replay";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

declare module "fastify" {
  interface FastifyRequest {
    idempotencyKey?: string;
  }
}

async function handleReplay(reply: FastifyReply, cached: string) {
  try {
    const record = JSON.parse(cached) as {
      body: string;
      contentType?: string;
    };
    if (record.contentType) {
      reply.header("content-type", record.contentType);
    }
    reply.header(REPLAY_HEADER, "1");
    reply.code(200);
    await reply.send(record.body);
  } catch {
    await reply.code(500).send({ error: "idempotency_store_corrupt" });
  }
}

async function saveResponse(request: FastifyRequest, reply: FastifyReply, payload: any) {
  const key = request.idempotencyKey;
  if (!key) {
    return payload;
  }
  const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;
  const body = typeof payload === "string" ? payload : payload ? payload.toString() : "";
  const record = JSON.stringify({
    body,
    contentType: reply.getHeader("content-type")?.toString(),
  });
  try {
    await redis.set(redisKey, record, "NX", "EX", DEFAULT_TTL_SECONDS);
  } catch (err) {
    request.log.error({ err }, "failed to persist idempotent response");
  }
  return payload;
}

export default async function idempotencyPlugin(fastify: FastifyInstance) {
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") {
      return;
    }
    const header = request.headers["idempotency-key"];
    if (!header || (Array.isArray(header) && header.length === 0)) {
      await reply.code(400).send({ error: "missing_idempotency_key" });
      return;
    }
    const key = Array.isArray(header) ? header[0] : header;
    if (!key.trim()) {
      await reply.code(400).send({ error: "invalid_idempotency_key" });
      return;
    }
    request.idempotencyKey = key;
    const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        await handleReplay(reply, cached);
        return;
      }
    } catch (err) {
      request.log.error({ err }, "failed to retrieve idempotent response");
    }
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "POST") {
      return payload;
    }
    if (!request.idempotencyKey) {
      return payload;
    }
    if (reply.getHeader(REPLAY_HEADER)) {
      return payload;
    }
    return saveResponse(request, reply, payload);
  });
}
