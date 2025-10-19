import { FastifyReply, FastifyRequest } from "fastify";

type ScopedRequest = FastifyRequest & {
  body?: { orgId?: string };
  params?: { orgId?: string };
  query?: { orgId?: string };
};

function extractOrgId(req: ScopedRequest): string | undefined {
  const fromParams = req.params && typeof req.params === "object" ? (req.params as any).orgId : undefined;
  if (typeof fromParams === "string") {
    return fromParams;
  }
  const fromQuery = req.query && typeof req.query === "object" ? (req.query as any).orgId : undefined;
  if (typeof fromQuery === "string") {
    return fromQuery;
  }
  const fromBody = req.body && typeof req.body === "object" ? (req.body as any).orgId : undefined;
  if (typeof fromBody === "string") {
    return fromBody;
  }
  return undefined;
}

export async function enforceOrgScope(req: FastifyRequest, reply: FastifyReply) {
  if (!req.orgId) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  const targetOrgId = extractOrgId(req as ScopedRequest);
  if (targetOrgId && targetOrgId !== req.orgId) {
    return reply.code(403).send({ error: "forbidden" });
  }
}
