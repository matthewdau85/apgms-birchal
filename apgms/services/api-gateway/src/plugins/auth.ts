export interface AuthenticatedUser {
  id: string;
  orgId: string;
  roles?: string[];
}

interface TokenPayload {
  sub?: string;
  id?: string;
  orgId?: string;
  roles?: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
    orgId?: string;
  }

  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<any>;
  }
}

const fp = (await import("fastify-plugin")).default;

const authPlugin = fp(async (app: any) => {
  const secret = process.env.JWT_SECRET;
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  if (!issuer) {
    throw new Error("JWT_ISSUER is required");
  }

  if (!audience) {
    throw new Error("JWT_AUDIENCE is required");
  }

  const jwtPlugin = (await import("@fastify/jwt")).default;
  await app.register(jwtPlugin, {
    secret,
    sign: {
      issuer,
      audience,
    },
    verify: {
      issuer,
      audience,
    },
  });

  app.decorateRequest("user", null);

  const authenticate = async (request: any, reply: any) => {
    try {
      const payload = (await request.jwtVerify()) as TokenPayload;
      const id = payload.sub ?? payload.id;
      const orgId = payload.orgId;

      if (!id || !orgId) {
        throw new Error("Invalid token payload");
      }

      request.user = {
        id,
        orgId,
        roles: payload.roles,
      } satisfies AuthenticatedUser;
    } catch (err) {
      request.user = null;
      if (request.log && request.log.warn) {
        request.log.warn({ err }, "authentication failed");
      }
      return reply.code(401).send({ code: "UNAUTHENTICATED" });
    }
  };

  app.decorate("authenticate", authenticate);
});

export default authPlugin;
