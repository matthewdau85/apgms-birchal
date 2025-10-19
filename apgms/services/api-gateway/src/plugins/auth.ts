/// <reference types="fastify/types/logger" />
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

type JwtUser = { id: string; orgId: string; roles?: string[] };

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUser;
  }
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const issuer = process.env.JWT_ISSUER || 'apgms';
  const audience = process.env.JWT_AUDIENCE || 'apgms-clients';

  await app.register(fjwt, {
    secret,
    sign: { issuer, audience, algorithm: 'HS256' },
    verify: { issuer, audience, algorithms: ['HS256'] },
  });

  app.decorate('authenticate', async (req, reply) => {
    try {
      const tok = await req.jwtVerify<{ id: string; orgId: string; roles?: string[] }>();
      if (!tok?.id || !tok?.orgId) throw new Error('missing-claims');
      req.user = { id: tok.id, orgId: tok.orgId, roles: tok.roles ?? [] };
    } catch {
      reply.code(401).send({ code: 'UNAUTHENTICATED' });
    }
  });
});

export default authPlugin;
