import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeAny } from "zod";

const responseGuard: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (request, reply, payload) => {
    if (process.env.NODE_ENV === "production") {
      return payload;
    }

    const zodResponse = (reply.context.schema as { zodResponse?: Record<number | string, ZodTypeAny> } | undefined)
      ?.zodResponse;

    if (!zodResponse) {
      return payload;
    }

    const statusCode = reply.statusCode ?? 200;
    const validator = zodResponse[statusCode] ?? zodResponse[String(statusCode)];

    if (!validator) {
      return payload;
    }

    let body: unknown = payload;

    if (typeof payload === "string") {
      try {
        body = payload.length ? JSON.parse(payload) : null;
      } catch (err) {
        request.log.error({ err }, "response guard failed to parse payload");
        const error = new Error("Response validation failed");
        (error as any).statusCode = 500;
        throw error;
      }
    } else if (Buffer.isBuffer(payload)) {
      try {
        body = payload.length ? JSON.parse(payload.toString("utf8")) : null;
      } catch (err) {
        request.log.error({ err }, "response guard failed to parse payload");
        const error = new Error("Response validation failed");
        (error as any).statusCode = 500;
        throw error;
      }
    }

    const result = validator.safeParse(body);

    if (!result.success) {
      request.log.error(
        {
          statusCode: reply.statusCode,
          issues: result.error.issues.map(({ message, path }) => ({ message, path })),
        },
        "response guard validation failed",
      );
      const error = new Error("Response validation failed");
      (error as any).statusCode = 500;
      throw error;
    }

    return payload;
  });
};

export default responseGuard;
