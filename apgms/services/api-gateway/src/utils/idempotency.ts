import type { FastifyReply, FastifyRequest } from "fastify";

type CachedResponse = {
  statusCode: number;
  payload: unknown;
  headers: Record<string, string>;
};

const cache = new Map<string, CachedResponse>();

function makeCacheKey(request: FastifyRequest, idempotencyKey: string): string {
  const route = request.routeOptions?.url ?? request.routerPath ?? request.url;
  return `${request.method}:${route}:${idempotencyKey}`;
}

export function clearIdempotencyCache(): void {
  cache.clear();
}

export function withIdempotency<Req extends FastifyRequest>(
  handler: (request: Req, reply: FastifyReply) => Promise<unknown> | unknown,
) {
  return async function idempotentHandler(request: Req, reply: FastifyReply) {
    const rawKey = request.headers["idempotency-key"];
    if (typeof rawKey !== "string" || rawKey.trim() === "") {
      request.log.warn("missing idempotency key");
      reply.code(400);
      return { error: "missing_idempotency_key" };
    }

    const cacheKey = makeCacheKey(request, rawKey);
    const cached = cache.get(cacheKey);
    if (cached) {
      request.log.info({ cacheKey }, "serving idempotent response from cache");
      reply.code(cached.statusCode);
      for (const [header, value] of Object.entries(cached.headers)) {
        reply.header(header, value);
      }
      return cached.payload;
    }

    const result = await handler(request, reply);
    if (!reply.sent) {
      const headers: Record<string, string> = {};
      for (const [header, value] of Object.entries(reply.getHeaders())) {
        headers[header] = Array.isArray(value) ? value.join(",") : String(value);
      }
      cache.set(cacheKey, {
        statusCode: reply.statusCode,
        payload: result,
        headers,
      });
      request.log.debug({ cacheKey }, "stored idempotent response");
    }
    return result;
  };
}
