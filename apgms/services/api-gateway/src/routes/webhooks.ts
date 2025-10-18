import { FastifyPluginAsync } from "fastify";
import webhookSigningPlugin, {
  InMemoryNonceStore,
  RedisLike,
  WebhookSigningOptions,
} from "../plugins/webhook-signing";

export interface WebhookRouteOptions {
  secret: string;
  redis?: RedisLike;
  skewSeconds?: number;
  nonceTtlSeconds?: number;
}

const webhooksRoutes: FastifyPluginAsync<WebhookRouteOptions> = async (fastify, opts) => {
  const secret = opts.secret;
  if (!secret) {
    throw new Error("Webhook secret is required");
  }

  const redis = opts.redis ?? new InMemoryNonceStore();

  await fastify.register(async (instance) => {
    await webhookSigningPlugin(instance, {
      secret,
      redis,
      skewSeconds: opts.skewSeconds,
      nonceTtlSeconds: opts.nonceTtlSeconds,
    } satisfies WebhookSigningOptions);

    instance.post("/webhooks/payto", {
      preHandler: instance.verifyWebhookSignature,
      handler: async (request, reply) => {
        void request;
        return reply.code(202).send({ status: "accepted" });
      },
    });
  });
};

export default webhooksRoutes;
