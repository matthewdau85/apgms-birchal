import { FastifyPluginAsync, FastifyReply } from "fastify";
import { ZodSchema } from "zod";

const replySchemaPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateReply("withSchema", function withSchema<T>(
    this: FastifyReply,
    schema: ZodSchema<T>,
    payload: unknown,
  ): T {
    const isProd = (process.env.NODE_ENV ?? "development") === "production" && process.env.CI !== "true";

    if (!isProd) {
      const parsed = schema.parse(payload);
      this.send(parsed);
      return parsed;
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      this.log.error({ err: result.error, payload }, "reply schema validation failed");
      this.send(payload as T);
      return payload as T;
    }

    this.send(result.data);
    return result.data;
  });
};

(replySchemaPlugin as any)[Symbol.for("skip-override")] = true;
(replySchemaPlugin as any)[Symbol.for("fastify.display-name")] = "reply-schema";

export default replySchemaPlugin;

declare module "fastify" {
  interface FastifyReply {
    withSchema<T>(schema: ZodSchema<T>, payload: unknown): T;
  }
}
