import fp from "fastify-plugin";
import type { FastifyBaseLogger } from "fastify";
import { applyRedaction } from "../lib/redact";

function applyToLogger(logger: FastifyBaseLogger): void {
  applyRedaction(logger);
}

export default fp(async (app) => {
  applyToLogger(app.log);

  app.addHook("onRequest", (request, _reply, done) => {
    applyToLogger(request.log);
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    request.log.info(
      {
        req_id: request.id,
        route: request.routerPath ?? request.url,
        status: reply.statusCode,
      },
      "request.completed",
    );
    done();
  });
});
