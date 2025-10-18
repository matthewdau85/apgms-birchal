import { FastifyReply, FastifyRequest } from "fastify";

export interface AuthenticatedUser {
  id: string;
  roles: string[];
  orgId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const parseToken = (token: string): AuthenticatedUser | null => {
  const [id, orgId, roleSegment] = token.split(":");
  if (!id || !orgId) {
    return null;
  }
  const roles = roleSegment ? roleSegment.split(",").filter(Boolean) : [];
  return { id, orgId, roles };
};

export const auth = () =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const token = header.slice("Bearer ".length).trim();
    const user = parseToken(token);
    if (!user) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    req.user = user;
  };

export const requireRole = (...roles: string[]) =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    if (roles.length === 0) {
      return;
    }

    const hasRole = roles.some((role) => req.user?.roles.includes(role));
    if (!hasRole) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }
  };
