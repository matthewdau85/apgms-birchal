import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
} from "fastify";
import type { ZodTypeAny } from "zod";

export type ZodRouteSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  querystring?: ZodTypeAny;
  headers?: ZodTypeAny;
  response?: Partial<Record<number, ZodTypeAny>> & { default?: ZodTypeAny };
};

declare module "fastify" {
  interface FastifyInstance {
    withValidation: (schemas: ZodRouteSchemas, handler: RouteHandlerMethod) => RouteHandlerMethod;
  }
}

const validationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "withValidation",
    function withValidation(schemas: ZodRouteSchemas, handler: RouteHandlerMethod) {
      return (async function validatedHandler(this: unknown, request: FastifyRequest, reply: FastifyReply) {
        if (schemas.headers) {
          const parsed = schemas.headers.parse(request.headers ?? {});
          Object.assign(request.headers, parsed);
        }

        if (schemas.querystring) {
          const parsed = schemas.querystring.parse(request.query ?? {});
          (request as unknown as { query: unknown }).query = parsed;
        }

        if (schemas.params) {
          const parsed = schemas.params.parse(request.params ?? {});
          (request as unknown as { params: unknown }).params = parsed;
        }

        if (schemas.body) {
          const parsed = schemas.body.parse(request.body ?? {});
          (request as unknown as { body: unknown }).body = parsed;
        }

        const result = await handler.apply(this as any, [request, reply]);

        if (!reply.sent && schemas.response) {
          const responseSchema = schemas.response[reply.statusCode] ?? schemas.response.default;
          if (responseSchema) {
            return responseSchema.parse(result);
          }
        }

        return result;
      }) as RouteHandlerMethod;
    }
  );
};

export default validationPlugin;
