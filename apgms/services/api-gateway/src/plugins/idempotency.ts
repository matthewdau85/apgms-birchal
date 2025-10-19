import { FastifyPluginAsync } from "fastify";

type StoredResponse = {
  statusCode: number;
  payload: unknown;
  headers: Record<string, string>;
};

const store = new Map<string, StoredResponse>();

const normalizeHeaderValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((v) => String(v)).join(", ");
  }

  return typeof value === "string" ? value : String(value);
};

const idempotencyPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    if (request.method !== "POST") {
      return;
    }

    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || key.length === 0) {
      return;
    }

    const cached = store.get(key);
    if (!cached) {
      return;
    }

    reply.code(cached.statusCode);
    reply.headers({ ...cached.headers });
    return reply.send(cached.payload);
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "POST") {
      return payload;
    }

    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || key.length === 0) {
      return payload;
    }

    if (reply.statusCode >= 200 && reply.statusCode < 400) {
      const headers = Object.entries(reply.getHeaders()).reduce<Record<string, string>>(
        (acc, [name, value]) => {
          const normalized = normalizeHeaderValue(value);
          if (normalized !== undefined) {
            acc[name] = normalized;
          }
          return acc;
        },
        {}
      );

      store.set(key, {
        statusCode: reply.statusCode,
        payload,
        headers,
      });
    }

    return payload;
  });
};

export default idempotencyPlugin;
export const __internal = {
  clear: () => store.clear(),
};
