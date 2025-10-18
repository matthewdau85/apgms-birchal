import { FastifyInstance } from "fastify";
import { createErrorResponse, ServiceError } from "../utils/errors";

export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    if ((error as any).validation) {
      const response = createErrorResponse(
        new ServiceError("validation_error", "Request validation failed", 400, (error as any).validation),
      );
      reply.status(400).send(response);
      return;
    }

    if (error instanceof ServiceError) {
      reply.status(error.statusCode).send(createErrorResponse(error));
      return;
    }

    request.log.error({ err: error }, "Unhandled error");
    reply.status(500).send(createErrorResponse(error));
  });
};
