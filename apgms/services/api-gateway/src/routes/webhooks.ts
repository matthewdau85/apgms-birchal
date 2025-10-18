import type { FastifyPluginAsync } from "fastify";
import {
  WebhookReplayError,
  WebhookVerificationError,
} from "../plugins/webhook-signing";

const webhooksRoutes: FastifyPluginAsync = async (app) => {
  app.removeAllContentTypeParsers();

  const stringParser = (
    _request: unknown,
    payload: unknown,
    done: (err: Error | null, body?: string) => void,
  ) => {
    if (typeof payload === "string") {
      return done(null, payload);
    }

    if (payload instanceof Buffer) {
      return done(null, payload.toString("utf8"));
    }

    return done(null, "");
  };

  app.addContentTypeParser(/^application\/json(;.*)?$/, { parseAs: "string" }, stringParser);
  app.addContentTypeParser("*", { parseAs: "string" }, stringParser);

  app.post("/webhooks/payto", async (request, reply) => {
    const rawBody = (request.body as string | undefined) ?? "";

    try {
      await app.verifyWebhookSignature(request, rawBody);
    } catch (error) {
      if (error instanceof WebhookReplayError) {
        return reply.code(error.statusCode).send({ error: error.code });
      }

      if (error instanceof WebhookVerificationError) {
        return reply.code(error.statusCode).send({ error: error.code });
      }

      throw error;
    }

    return reply.code(202).send({ accepted: true });
  });
};

export default webhooksRoutes;
