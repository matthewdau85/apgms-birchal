import crypto from "node:crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { getRedis } from "../lib/redis";

interface StoredResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  hash: string;
  isJson: boolean;
}

const isJsonContentType = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }
  return value.toLowerCase().includes("application/json");
};

const serializeHeaders = (headers: Record<string, unknown>): Record<string, string> => {
  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      acc[key] = String(value);
    }
    return acc;
  }, {});
};

export const idempotency = () => {
  const redis = getRedis();

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (req.method.toUpperCase() !== "POST") {
      return;
    }

    const keyHeader = req.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
    if (!idempotencyKey) {
      return;
    }

    const bodyHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body ?? {}))
      .digest("hex");

    const cached = await redis.get(idempotencyKey);
    if (cached) {
      const payload = JSON.parse(cached) as StoredResponse;
      if (payload.hash !== bodyHash) {
        reply.code(409).send({ error: "idempotency_conflict" });
        return;
      }

      reply.code(payload.statusCode);
      for (const [header, value] of Object.entries(payload.headers)) {
        reply.header(header, value);
      }
      if (payload.isJson) {
        reply.send(JSON.parse(payload.body));
      } else {
        reply.send(payload.body);
      }
      return;
    }

    const originalSend = reply.send.bind(reply);
    reply.send = ((responseBody: unknown) => {
      const serializedBody =
        typeof responseBody === "string"
          ? responseBody
          : JSON.stringify(responseBody ?? null) ?? "null";
      const headers = serializeHeaders(reply.getHeaders() as Record<string, unknown>);
      const isJson =
        isJsonContentType(headers["content-type"]) || typeof responseBody !== "string";

      void redis.set(
        idempotencyKey,
        JSON.stringify({
          statusCode: reply.statusCode,
          headers,
          body: serializedBody,
          hash: bodyHash,
          isJson,
        } satisfies StoredResponse),
        "PX",
        24 * 60 * 60 * 1000,
      );

      if (isJson && typeof responseBody === "string") {
        try {
          return originalSend(JSON.parse(responseBody));
        } catch {
          return originalSend(responseBody);
        }
      }

      return originalSend(responseBody);
    }) as typeof reply.send;
  };
};
