import type { FastifyInstance } from "fastify";
import type { ZodTypeAny, input } from "zod";

declare module "fastify" {
  interface FastifyReply {
    withSchema<T extends ZodTypeAny>(
      schema: T,
      payload: input<T>
    ): FastifyReply;
  }
}

const isProduction = () => process.env.NODE_ENV === "production";

export const decorateReplyWithSchema = (app: FastifyInstance) => {
  app.decorateReply(
    "withSchema",
    function withSchema<T extends ZodTypeAny>(schema: T, payload: input<T>) {
      const result = schema.safeParse(payload);

      if (!result.success) {
        if (isProduction()) {
          this.log.error(
            { issues: result.error.issues },
            "Reply schema validation failed"
          );
          return this.send(payload);
        }

        const error = new Error("Reply schema validation failed");
        (error as any).cause = result.error;
        (error as any).issues = result.error.issues;
        throw error;
      }

      return this.send(result.data);
    }
  );
};

