import crypto from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    useIdempotency<T>(
      request: FastifyRequest,
      reply: FastifyReply,
      executor: () => Promise<T>
    ): Promise<T | undefined>;
  }
}

const normalizePath = (path: string) => path.split("?")[0];
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  requestHash: string;
  response: unknown;
  responseCode: number;
  createdAt: number;
};

const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
  const cache = new Map<string, CacheEntry>();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.createdAt + ENTRY_TTL_MS <= now) {
        cache.delete(key);
      }
    }
  };

  fastify.addHook("onResponse", cleanup);

  fastify.decorate(
    "useIdempotency",
    async function useIdempotency(
      request: FastifyRequest,
      reply: FastifyReply,
      executor: () => Promise<unknown>
    ) {
      const header = request.headers["idempotency-key"];
      if (typeof header !== "string" || header.trim().length === 0) {
        await reply.code(400).send({ error: "missing_idempotency_key" });
        return undefined;
      }

      const key = header.trim();
      const payload = request.body ?? null;
      const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
      const method = request.method.toUpperCase();
      const path = normalizePath(request.routeOptions?.url ?? request.url);
      const cacheKey = `${request.orgId}:${method}:${path}:${key}`;

      const existing = cache.get(cacheKey);
      if (existing) {
        if (existing.requestHash !== payloadHash) {
          await reply.code(409).send({ error: "idempotency_conflict" });
          return undefined;
        }

        await reply.code(200).send(existing.response);
        return undefined;
      }

      const result = await executor();

      if (reply.sent) {
        return undefined;
      }

      const normalizedResponse = result === undefined ? null : JSON.parse(JSON.stringify(result));
      cache.set(cacheKey, {
        requestHash: payloadHash,
        response: normalizedResponse,
        responseCode: reply.statusCode,
        createdAt: Date.now(),
      });

      return result;
    }
  );
};

export default idempotencyPlugin;
