import type { FastifyReply } from "fastify";
import type { ZodSchema } from "zod";

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return reply.code(statusCode).send({ error: { code, message, details } });
}

export function sendSuccess<T>(
  reply: FastifyReply,
  schema: ZodSchema<T>,
  payload: T,
  statusCode = 200,
  meta?: Record<string, unknown>
) {
  const data = schema.parse(payload);
  return reply.code(statusCode).send({ data, meta });
}

export function formatSuccessPayload<T>(
  schema: ZodSchema<T>,
  payload: T,
  meta?: Record<string, unknown>
) {
  const data = schema.parse(payload);
  return { data, meta };
}
