import type {
  FastifyReply,
  FastifyRequest,
  preSerializationHookHandler,
  preValidationHookHandler,
} from "fastify";
import { ZodError, type ZodTypeAny } from "zod";

const formatIssues = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

const handleValidationFailure = (
  reply: FastifyReply,
  error: ZodError,
  source: "body" | "query"
) => {
  reply.log.warn({ source, issues: error.issues }, "validation failed");
  reply.code(400).send({
    error: "validation_error",
    source,
    issues: formatIssues(error),
  });
};

export const validateBody = <Schema extends ZodTypeAny>(
  schema: Schema
): preValidationHookHandler => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void | FastifyReply> => {
    const result = await schema.safeParseAsync(request.body);
    if (!result.success) {
      handleValidationFailure(reply, result.error, "body");
      return reply;
    }

    (request as any).body = result.data;
  };
};

export const validateQuery = <Schema extends ZodTypeAny>(
  schema: Schema
): preValidationHookHandler => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void | FastifyReply> => {
    const result = await schema.safeParseAsync(request.query);
    if (!result.success) {
      handleValidationFailure(reply, result.error, "query");
      return reply;
    }

    (request as any).query = result.data;
  };
};

export const validateReply = <Schema extends ZodTypeAny>(
  schema: Schema
): preSerializationHookHandler => {
  return async (request, reply, payload) => {
    const result = await schema.safeParseAsync(payload);
    if (!result.success) {
      request.log.error({ issues: result.error.issues }, "reply validation failed");
      reply.code(500);
      return {
        error: "internal_error",
      };
    }

    return result.data;
  };
};
