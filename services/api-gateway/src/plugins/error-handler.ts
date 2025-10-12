import { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(422).send({ code: "validation_error", issues: err.issues });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return reply.status(409).send({ code: "conflict", meta: err.meta });
      if (err.code === "P2025") return reply.status(404).send({ code: "not_found", meta: err.meta });
      return reply.status(400).send({ code: "bad_request", meta: err.meta });
    }
    req.log.error({ err }, "unhandled_error");
    return reply.status(500).send({ code: "internal_error" });
  });
};
