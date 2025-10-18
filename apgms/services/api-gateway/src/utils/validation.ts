import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError, type ZodSchema } from "zod";

export function parseOrFail<T>(
  schema: ZodSchema<T>,
  data: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  context: string,
): T | undefined {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      request.log.warn({ issues: error.issues, data }, `${context}: validation failed`);
      reply.code(400).send({ error: "validation_error", context, issues: error.issues });
      return undefined;
    }
    request.log.error({ err: error }, `${context}: unexpected validation failure`);
    reply.code(400).send({ error: "validation_error", context });
    return undefined;
  }
}
