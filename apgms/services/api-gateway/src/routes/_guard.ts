import { FastifyReply, FastifyRequest } from "fastify";

type OrgExtractor = (request: FastifyRequest) => string | null | undefined;

type Role = string;

export const orgScope = (orgIdFromReq: OrgExtractor) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const context = request.context;
    if (!context) {
      reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    const desiredOrgId = orgIdFromReq(request);
    if (!desiredOrgId) {
      reply.code(400).send({ error: "missing_org" });
      return reply;
    }
    const { orgId } = context;
    if (orgId !== desiredOrgId) {
      reply.code(403).send({ error: "forbidden" });
      return reply;
    }
  };
};

export const requireRole = (...roles: Role[]) => {
  const expected = roles.map((role) => role.trim()).filter(Boolean);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const context = request.context;
    if (!context) {
      reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    const { roles: currentRoles } = context;
    if (expected.length === 0) {
      return;
    }
    if (!currentRoles.some((role) => expected.includes(role))) {
      reply.code(403).send({ error: "forbidden" });
      return reply;
    }
  };
};
