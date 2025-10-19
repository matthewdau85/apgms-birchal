import type { FastifyRequest } from "fastify";

function extractFromObject(source: unknown): string | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const candidate = (source as Record<string, unknown>).orgId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

export function getRequestOrgId(req: FastifyRequest): string | undefined {
  return (
    extractFromObject(req.query) ??
    extractFromObject(req.body) ??
    extractFromObject(req.params)
  );
}
