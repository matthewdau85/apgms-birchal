import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
} from "fastify";
import type { ZodTypeAny } from "zod";

const REPLY_SCHEMA_SYMBOL = Symbol.for("reply-schema");

interface ReplyWithSchema extends FastifyReply {
  [REPLY_SCHEMA_SYMBOL]?: ZodTypeAny;
}

type Payload = unknown;

type WithValidatedReply = <T extends RouteHandlerMethod>(schema: ZodTypeAny, handler: T) => T;

const parsePayload = (payload: Payload): unknown => {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Buffer.isBuffer(payload)) {
    const text = payload.toString("utf8");
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  return payload;
};

const clearSchema = (reply: ReplyWithSchema) => {
  delete reply[REPLY_SCHEMA_SYMBOL];
};

export const withValidatedReply: WithValidatedReply = (schema, handler) => {
  const wrapped: RouteHandlerMethod = async function (this: FastifyInstance, request, reply) {
    (reply as ReplyWithSchema)[REPLY_SCHEMA_SYMBOL] = schema;
    try {
      return await handler.apply(this, [request, reply]);
    } finally {
      // schema cleared in onSend hook
    }
  };

  return Object.assign(wrapped, handler) as typeof handler;
};

const replyValidationPlugin = async (app: FastifyInstance) => {
  app.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload) => {
    const replyWithSchema = reply as ReplyWithSchema;
    const schema = replyWithSchema[REPLY_SCHEMA_SYMBOL];

    if (!schema) {
      return payload;
    }

    if (reply.statusCode >= 400) {
      clearSchema(replyWithSchema);
      return payload;
    }

    const data = parsePayload(payload);
    const result = schema.safeParse(data);

    if (!result.success) {
      request.log.error({ validationErrors: result.error.errors }, "reply validation failed");
      clearSchema(replyWithSchema);
      reply.code(500).type("application/json");

      const responseBody =
        process.env.NODE_ENV === "production"
          ? { error: "internal_server_error" }
          : { error: "invalid_response_payload", details: result.error.flatten() };

      const serialized = reply.serialize(responseBody);
      if (typeof serialized === "string" || Buffer.isBuffer(serialized)) {
        return serialized;
      }

      if (serialized instanceof ArrayBuffer) {
        return Buffer.from(serialized);
      }

      return JSON.stringify(responseBody);
    }

    clearSchema(replyWithSchema);
    return payload;
  });
};

export default replyValidationPlugin;
