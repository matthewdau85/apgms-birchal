import type { FastifyBaseLogger, FastifyRequest } from "fastify";

export function logError(
  request: FastifyRequest,
  error: unknown,
  metadata: Record<string, unknown> = {},
): void {
  const logger: FastifyBaseLogger = request.log;
  logger.error({ err: error, ...metadata }, "request_failed");
}
