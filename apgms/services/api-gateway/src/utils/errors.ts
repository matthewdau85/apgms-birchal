import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { logError } from "./logging";

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, "bad_request", message, details);
}

export function unauthorized(message = "Authentication required"): AppError {
  return new AppError(401, "unauthorized", message);
}

export function forbidden(message = "Forbidden"): AppError {
  return new AppError(403, "forbidden", message);
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError(404, "not_found", message);
}

function sendError(reply: FastifyReply, statusCode: number, payload: ErrorPayload): void {
  if (!reply.sent) {
    reply.code(statusCode).send({ error: payload });
  }
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      const payload: ErrorPayload = {
        code: "validation_error",
        message: "Request validation failed",
        details: error.flatten(),
      };
      sendError(reply, 400, payload);
      return;
    }

    if (isAppError(error)) {
      const payload: ErrorPayload = {
        code: error.code,
        message: error.message,
        details: error.details,
      };
      sendError(reply, error.statusCode, payload);
      return;
    }

    logError(request, error, { type: "unhandled" });
    const payload: ErrorPayload = {
      code: "internal_server_error",
      message: "An unexpected error occurred",
    };
    sendError(reply, 500, payload);
  });

  app.setNotFoundHandler((request, reply) => {
    sendError(reply, 404, {
      code: "not_found",
      message: `Route ${request.method} ${request.url} was not found`,
    });
  });
}
