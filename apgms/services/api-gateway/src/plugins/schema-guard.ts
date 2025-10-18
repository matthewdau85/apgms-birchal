import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { responseSchemaRegistry } from "../schemas/responses.js";

const registerSchemaGuard = (app: FastifyInstance) => {
  app.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode >= 500) {
      return payload;
    }

    const routePath = resolveRoutePath(request);
    if (!routePath) {
      return payload;
    }

    const schemaKey = `${request.method.toUpperCase()} ${routePath}`;
    const validator = responseSchemaRegistry[schemaKey];
    if (!validator) {
      return payload;
    }

    const decoded = decodePayload(payload);
    if (decoded === undefined) {
      return payload;
    }

    const validation = validator.safeParse(decoded);
    if (validation.success) {
      return payload;
    }

    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ??
      (reply.getHeader("x-correlation-id") as string | undefined) ??
      String(request.id);

    const logContext = {
      correlationId,
      issues: mapZodIssues(validation.error),
      payloadSample: snapshotPayload(decoded),
      route: schemaKey,
    };

    const message = "response schema validation failed";

    if (isProduction()) {
      request.log.error(logContext, message);
      return payload;
    }

    request.log.error(logContext, message);
    reply.code(500);
    reply.statusCode = 500;
    reply.raw.statusCode = 500;
    reply.header("content-type", "application/json");
    return JSON.stringify({
      correlationId,
      error: "response_schema_validation_failed",
    });
  });
};

export default registerSchemaGuard;

const isProduction = () => process.env.NODE_ENV === "production";

const decodePayload = (payload: unknown): unknown => {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return undefined;
    }
  }

  if (payload instanceof Buffer) {
    try {
      return JSON.parse(payload.toString("utf8"));
    } catch {
      return undefined;
    }
  }

  if (payload instanceof Uint8Array) {
    try {
      return JSON.parse(Buffer.from(payload).toString("utf8"));
    } catch {
      return undefined;
    }
  }

  if (typeof payload === "object") {
    return payload;
  }

  return undefined;
};

const snapshotPayload = (payload: unknown) => {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return null;
  }
};

const mapZodIssues = (error: ZodError) =>
  error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path,
  }));

const resolveRoutePath = (request: FastifyRequest): string | undefined => {
  const candidate = (request as FastifyRequest & { routerPath?: string }).routerPath;
  return candidate ?? request.routeOptions?.url ?? request.url;
};
