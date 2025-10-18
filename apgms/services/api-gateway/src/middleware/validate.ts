import { FastifyRequest } from "fastify";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

type Infer<Schema extends ZodTypeAny> = ZodInfer<Schema>;

const parseOrThrow = <Schema extends ZodTypeAny>(schema: Schema, value: unknown, statusCode: number): Infer<Schema> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error("Validation failed");
    (error as any).statusCode = statusCode;
    (error as any).validation = result.error.flatten();
    throw error;
  }
  return result.data as Infer<Schema>;
};

export const validateBody = <Schema extends ZodTypeAny>(schema: Schema) => {
  return <Req extends FastifyRequest>(req: Req): Infer<Schema> => {
    const parsed = parseOrThrow(schema, req.body, 400);
    (req as any).body = parsed;
    return parsed;
  };
};

export const validateQuery = <Schema extends ZodTypeAny>(schema: Schema) => {
  return <Req extends FastifyRequest>(req: Req): Infer<Schema> => {
    const parsed = parseOrThrow(schema, req.query, 400);
    (req as any).query = parsed;
    return parsed;
  };
};

export const validateReply = <Schema extends ZodTypeAny>(schema: Schema) => {
  return (payload: unknown): Infer<Schema> => {
    return parseOrThrow(schema, payload, 500);
  };
};
