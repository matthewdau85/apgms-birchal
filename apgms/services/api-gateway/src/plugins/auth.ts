import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export type TokenPayload = {
  sub: string;
  email: string;
  orgId: string;
  roles?: string[];
};

declare module "fastify" {
  interface FastifyRequest {
    user?: TokenPayload;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const unauthorizedError = () => {
  const err = new Error("Unauthorized");
  (err as any).statusCode = 401;
  return err;
};

const authPlugin = async (app: FastifyInstance) => {
  app.decorateRequest("user", null);

  app.decorate("authenticate", async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      reply.code(401);
      throw unauthorizedError();
    }

    const token = authHeader.slice("Bearer ".length).trim();

    let payload: TokenPayload;
    try {
      const decoded = Buffer.from(token, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);

      if (
        typeof parsed?.sub !== "string" ||
        typeof parsed?.email !== "string" ||
        typeof parsed?.orgId !== "string" ||
        (parsed.roles !== undefined && !Array.isArray(parsed.roles))
      ) {
        throw unauthorizedError();
      }

      payload = {
        sub: parsed.sub,
        email: parsed.email,
        orgId: parsed.orgId,
        roles: Array.isArray(parsed.roles) ? parsed.roles : undefined,
      };
    } catch {
      reply.code(401);
      throw unauthorizedError();
    }

    request.user = payload;
  });
};

export default authPlugin;
