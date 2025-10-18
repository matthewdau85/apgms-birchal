import { FastifyReply, FastifyRequest } from "fastify";

export const orgScope = () =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userOrgId = req.user?.orgId;
    const requestOrgId = (() => {
      const queryOrgId = (req.query as Record<string, unknown> | undefined)?.orgId;
      if (typeof queryOrgId === "string" && queryOrgId) {
        return queryOrgId;
      }
      const bodyOrgId = (req.body as Record<string, unknown> | undefined)?.orgId;
      if (typeof bodyOrgId === "string" && bodyOrgId) {
        return bodyOrgId;
      }
      return null;
    })();

    if (!userOrgId || !requestOrgId || requestOrgId !== userOrgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }
  };
