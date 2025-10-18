import type { FastifyReply } from "fastify";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

interface ReplyValidator<Schema extends ZodTypeAny> {
  code: (statusCode: number) => ReplyValidator<Schema>;
  send: (payload: ZodInfer<Schema>) => FastifyReply;
}

export const replyValidate = <Schema extends ZodTypeAny>(
  reply: FastifyReply,
  schema: Schema,
): ReplyValidator<Schema> => {
  const builder: ReplyValidator<Schema> = {
    code(statusCode) {
      reply.code(statusCode);
      return builder;
    },
    send(payload) {
      const parsed = schema.parse(payload);
      return reply.send(parsed);
    },
  };

  return builder;
};
