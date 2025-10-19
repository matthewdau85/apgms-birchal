import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface AuthContext {
  orgId: string;
  userId: string;
}

export class AuthGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthGuardError";
  }
}

export function parseAuthContext(request: FastifyRequest): AuthContext {
  const orgHeader = request.headers["x-org-id"];
  const userHeader = request.headers["x-user-id"];
  if (!orgHeader || !userHeader) {
    throw new AuthGuardError("Missing authentication headers");
  }

  const orgId = Array.isArray(orgHeader) ? orgHeader[0] : orgHeader;
  const userId = Array.isArray(userHeader) ? userHeader[0] : userHeader;

  if (!orgId || !userId) {
    throw new AuthGuardError("Malformed authentication headers");
  }

  return { orgId, userId };
}

export async function registerAuthGuard(app: FastifyInstance): Promise<void> {
  app.decorateRequest("authContext", null);

  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const config =
      (request.routeOptions as any)?.config ??
      (request as any).context?.config ??
      request.routeConfig;
    const requiresAuth = config?.auth !== false;
    if (!requiresAuth) {
      return;
    }

    try {
      request.authContext = parseAuthContext(request);
    } catch (error) {
      request.log.warn({ err: error }, "auth guard rejected request");
      reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
  });
}

declare module "fastify" {
  interface FastifyRequest {
    authContext: AuthContext | null;
  }
  interface RouteConfig {
    auth?: boolean;
  }
}
