import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

type SchemaBundle<Q, B, P, R> = {
  query?: z.ZodType<Q>;
  body?: z.ZodType<B>;
  params?: z.ZodType<P>;
  response: z.ZodType<R>;
};

type Parsed<Q, B, P> = {
  query: Q;
  body: B;
  params: P;
};

type Handler<Q, B, P, R> = (context: {
  req: FastifyRequest;
  rep: FastifyReply;
  parsed: Parsed<Q, B, P>;
}) => Promise<R> | R;

function respondBadRequest(rep: FastifyReply, error: z.ZodError) {
  return rep.code(400).send({
    error: "bad_request",
    issues: error.flatten(),
  });
}

export function withSchema<
  Q = undefined,
  B = undefined,
  P = undefined,
  R = unknown,
>(schema: SchemaBundle<Q, B, P, R>, handler: Handler<Q, B, P, R>) {
  return async function withValidatedSchema(req: FastifyRequest, rep: FastifyReply) {
    const queryResult = schema.query?.safeParse(req.query ?? {}) as
      | z.SafeParseReturnType<unknown, Q>
      | undefined;
    if (queryResult && !queryResult.success) {
      return respondBadRequest(rep, queryResult.error);
    }

    const bodyResult = schema.body?.safeParse(req.body ?? {}) as
      | z.SafeParseReturnType<unknown, B>
      | undefined;
    if (bodyResult && !bodyResult.success) {
      return respondBadRequest(rep, bodyResult.error);
    }

    const paramsResult = schema.params?.safeParse(req.params ?? {}) as
      | z.SafeParseReturnType<unknown, P>
      | undefined;
    if (paramsResult && !paramsResult.success) {
      return respondBadRequest(rep, paramsResult.error);
    }

    const parsed: Parsed<Q, B, P> = {
      query: queryResult?.data as Q,
      body: bodyResult?.data as B,
      params: paramsResult?.data as P,
    };

    const result = await handler({ req, rep, parsed });
    const responseResult = schema.response.safeParse(result);

    if (!responseResult.success) {
      req.log.error({ issues: responseResult.error.flatten() }, "response schema validation failed");
      if (process.env.NODE_ENV === "production") {
        if (!rep.sent) {
          return rep.code(500).send({ error: "internal_server_error" });
        }
        return;
      }
      throw new Error(`Response validation failed: ${responseResult.error.message}`);
    }

    return responseResult.data;
  };
}
