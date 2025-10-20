import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeAny } from "zod";

declare module "fastify" {
  interface FastifyContextConfig {
    responseGuard?: Record<string, ZodTypeAny>;
  }
}

const responseGuardPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRoute", (routeOptions) => {
    const response = routeOptions.schema?.response as
      | Record<string, unknown>
      | undefined;

    if (!response) {
      return;
    }

    const zodSchemas = Object.fromEntries(
      Object.entries(response).filter(([, schema]) => {
        if (!schema || typeof schema !== "object") {
          return false;
        }
        return typeof (schema as ZodTypeAny).safeParse === "function";
      })
    ) as Record<string, ZodTypeAny>;

    if (Object.keys(zodSchemas).length === 0) {
      return;
    }

    routeOptions.config = {
      ...routeOptions.config,
      responseGuard: {
        ...(routeOptions.config?.responseGuard ?? {}),
        ...zodSchemas,
      },
    };
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    const schemaMap = reply.context.config?.responseGuard;

    if (!schemaMap) {
      return payload;
    }

    const statusKey = String(reply.statusCode);
    const schema = schemaMap[statusKey] ?? schemaMap.default;

    if (!schema) {
      return payload;
    }

    let body: unknown = payload;

    if (Buffer.isBuffer(payload)) {
      const text = payload.toString("utf8");
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    } else if (typeof payload === "string") {
      try {
        body = JSON.parse(payload);
      } catch {
        body = payload;
      }
    }

    const result = schema.safeParse(body);

    if (result.success) {
      return payload;
    }

    const errorPayload = {
      route: request.routerPath,
      statusCode: reply.statusCode,
      issues: result.error.issues,
    };

    request.log.error(errorPayload, "response validation failed");

    if (process.env.NODE_ENV === "production") {
      return payload;
    }

    throw fastify.httpErrors.internalServerError("Response validation failed");
  });
};

export default fp(responseGuardPlugin, {
  name: "response-guard",
});
