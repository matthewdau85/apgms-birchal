import fp from "fastify-plugin";
import type { FastifyReply, FastifyPluginAsync } from "fastify";
import { ZodTypeAny } from "zod";

const shouldValidate = () => process.env.NODE_ENV !== "production";

const parsePayload = (payload: unknown, reply: FastifyReply): unknown => {
  if (payload === null || payload === undefined) {
    return payload;
  }

  const contentType = reply.getHeader("content-type");
  const isJson = typeof contentType === "string" && contentType.includes("application/json");

  if (typeof payload === "string") {
    if (!isJson) {
      return payload;
    }
    return JSON.parse(payload);
  }

  if (Buffer.isBuffer(payload)) {
    if (!isJson) {
      return payload;
    }
    return JSON.parse(payload.toString("utf-8"));
  }

  return payload;
};

const responseGuardPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (request, reply, payload) => {
    if (!shouldValidate()) {
      return payload;
    }

    const zodResponse: ZodTypeAny | undefined =
      (request.routeOptions?.schema as { zodResponse?: ZodTypeAny } | undefined)?.zodResponse;

    if (!zodResponse) {
      return payload;
    }

    let data: unknown = payload;

    try {
      data = parsePayload(payload, reply);
    } catch (error) {
      request.log.error({ err: error }, "response guard: failed to parse payload for validation");
      reply.code(500);
      throw new Error("Response validation failed");
    }

    const validationResult = zodResponse.safeParse(data);

    if (!validationResult.success) {
      request.log.error({ err: validationResult.error }, "response guard: schema validation failed");
      reply.code(500);
      throw new Error("Response validation failed");
    }

    return payload;
  });
};

export default fp(responseGuardPlugin);
