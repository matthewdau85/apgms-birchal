import type { FastifyReply, FastifyRequest } from "fastify";

function extractOrgIds(candidate: unknown): string[] {
  if (!candidate || typeof candidate !== "object") {
    return [];
  }

  if (Array.isArray(candidate)) {
    return candidate.flatMap(extractOrgIds);
  }

  const value = (candidate as Record<string, unknown>).orgId;
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

export async function orgScopeMiddleware(req: FastifyRequest, reply: FastifyReply) {
  if (!req.orgId) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  const ids = new Set<string>();
  for (const source of [req.params, req.query, req.body]) {
    for (const id of extractOrgIds(source)) {
      ids.add(id);
    }
  }

  if (ids.size === 0) {
    return;
  }

  if (ids.size > 1 || !ids.has(req.orgId)) {
    reply.code(403).send({ error: "forbidden" });
    return;
  }
}
