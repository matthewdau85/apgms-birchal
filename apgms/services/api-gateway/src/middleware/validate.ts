import { FastifyReply, FastifyRequest } from "fastify";
import { ZodTypeAny, z } from "zod";

export const validateBody = <T extends ZodTypeAny>(schema: T) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error: "invalid_body",
        details: result.error.flatten(),
      });
    }

    (request as FastifyRequest & { body: z.infer<T> }).body = result.data;
  };

export const validateQuery = <T extends ZodTypeAny>(schema: T) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({
        error: "invalid_query",
        details: result.error.flatten(),
      });
    }

    (request as FastifyRequest & { query: z.infer<T> }).query = result.data;
  };

export const validateReply = <T extends ZodTypeAny>(schema: T) =>
  async (_request: FastifyRequest, _reply: FastifyReply, payload: unknown) => {
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new Error("Invalid response payload");
    }

    return result.data;
  };
