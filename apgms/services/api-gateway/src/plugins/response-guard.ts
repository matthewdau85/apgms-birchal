import type { FastifyInstance } from "fastify";

const guardError = new Error("Response payload missing");

export const responseGuard = async (app: FastifyInstance) => {
  app.addHook("onSend", async (request, reply, payload) => {
    if (payload === undefined || payload === null) {
      request.log.error({ method: request.method, url: request.url }, "Response payload missing");
      throw guardError;
    }

    return payload;
  });
};

export default responseGuard;
