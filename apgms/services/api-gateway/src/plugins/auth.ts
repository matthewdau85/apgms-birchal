import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@apgms/shared/src/db";

const TOKEN_REGEX = /^org:([a-zA-Z0-9_-]+)(?::user:([a-zA-Z0-9_-]+))?$/;

type OrgRecord = {
  id: string;
  name: string;
};

declare module "fastify" {
  interface FastifyRequest {
    orgId: string;
    org: OrgRecord;
    authToken: string;
    userId?: string;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const orgCache = new Map<string, OrgRecord>();

  fastify.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS" || request.url === "/health") {
      return;
    }

    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      reply.header("www-authenticate", "Bearer");
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const token = header.slice("Bearer ".length).trim();
    const match = TOKEN_REGEX.exec(token);
    if (!match) {
      reply.header("www-authenticate", "Bearer error=\"invalid_token\"");
      await reply.code(401).send({ error: "invalid_token" });
      return;
    }

    const [, orgId, userId] = match;

    let org: OrgRecord | undefined = orgCache.get(orgId);
    if (!org) {
      const found = (await prisma.org.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      })) as OrgRecord | null;

      if (!found) {
        await reply.code(403).send({ error: "forbidden" });
        return;
      }

      org = found;
      orgCache.set(orgId, org);
    }

    request.orgId = orgId;
    request.org = org;
    request.authToken = token;
    request.userId = userId ?? undefined;
  });
};

export default authPlugin;
