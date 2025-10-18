import type { FastifyPluginAsync } from "fastify";

const responseGuard: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (_request, reply, payload) => {
    if (
      typeof payload === "object" &&
      payload !== null &&
      !reply.hasHeader("content-type")
    ) {
      reply.header("content-type", "application/json; charset=utf-8");
    }

    return payload;
  });
};

export default responseGuard;
