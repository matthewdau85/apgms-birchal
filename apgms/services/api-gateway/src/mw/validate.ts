import { FastifyReply, FastifyRequest } from "fastify";
import { ZodTypeAny, z } from "zod";

const buildValidator = <T extends ZodTypeAny>(
  schema: T,
  read: (req: FastifyRequest) => unknown,
  write: (req: FastifyRequest, value: z.infer<T>) => void,
) =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = schema.safeParse(read(req));
    if (!result.success) {
      reply.code(400).send({
        error: "validation_error",
        details: result.error.flatten(),
      });
      return;
    }

    write(req, result.data);
  };

export const validateBody = <T extends ZodTypeAny>(schema: T) =>
  buildValidator(
    schema,
    (req) => req.body,
    (req, value) => {
      (req as FastifyRequest<{ Body: z.infer<T> }>).body = value;
    },
  );

export const validateQuery = <T extends ZodTypeAny>(schema: T) =>
  buildValidator(
    schema,
    (req) => req.query,
    (req, value) => {
      (req as FastifyRequest<{ Querystring: z.infer<T> }>).query = value;
    },
  );

export const validateParams = <T extends ZodTypeAny>(schema: T) =>
  buildValidator(
    schema,
    (req) => req.params,
    (req, value) => {
      (req as FastifyRequest<{ Params: z.infer<T> }>).params = value;
    },
  );
