import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const startTimeKey = Symbol("requestStartTime");

type SecurityEventDetails = Record<string, unknown>;

const loggingPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("requestId", "");

  fastify.decorate("logSecurityEvent", (event: string, details: SecurityEventDetails = {}) => {
    fastify.log.warn({
      type: "security_event",
      event,
      ...details,
    });
  });

  fastify.decorateRequest(
    "logSecurityEvent",
    function (this: FastifyRequest, event: string, details: SecurityEventDetails = {}) {
      fastify.logSecurityEvent(event, { req_id: this.requestId, ...details });
    },
  );

  fastify.addHook("onRequest", async (request, reply) => {
    const requestId = request.id ?? randomUUID();
    request.requestId = requestId;
    (request as any)[startTimeKey] = process.hrtime.bigint();
    reply.header("x-request-id", requestId);

    request.log = request.log.child({ req_id: requestId }) as typeof request.log;
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const startTime = (request as any)[startTimeKey] as bigint | undefined;
    const latency = startTime ? Number((process.hrtime.bigint() - startTime) / BigInt(1e6)) : 0;

    request.log.info(
      {
        req_id: request.requestId,
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
        latency,
      },
      "request completed",
    );
  });
};

export default fp(loggingPlugin);

declare module "fastify" {
  interface FastifyInstance {
    logSecurityEvent(event: string, details?: SecurityEventDetails): void;
  }

  interface FastifyRequest {
    requestId: string;
    logSecurityEvent(event: string, details?: SecurityEventDetails): void;
  }
}
