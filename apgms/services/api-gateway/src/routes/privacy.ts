import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type PrismaClient = {
  org: {
    findUnique: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
  };
  user: {
    findMany: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
  };
  bankLine: {
    findMany: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
  };
  auditBlob?: {
    create: (args: any) => Promise<any>;
  };
};

type AuthedUser = {
  id?: string;
  orgId?: string;
  roles?: string[];
};

type AuthedRequest = FastifyRequest & { user?: AuthedUser };

type PrivacyDeps = {
  prisma: PrismaClient;
};

function ensureAdmin(request: AuthedRequest, reply: FastifyReply): AuthedUser | null {
  const user = request.user;
  const roles = Array.isArray(user?.roles) ? user?.roles : [];
  if (!user || !roles.includes("admin")) {
    void reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return user;
}

function resolveOrgId(request: AuthedRequest, user: AuthedUser, reply: FastifyReply): string | null {
  const query = (request.query ?? {}) as { orgId?: string };
  const orgId = query.orgId ?? user.orgId;
  if (!orgId) {
    void reply.code(400).send({ error: "missing_org" });
    return null;
  }
  if (user.orgId && user.orgId !== orgId) {
    void reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return orgId;
}

export function registerPrivacyRoutes(app: FastifyInstance, deps: PrivacyDeps) {
  app.get("/privacy/export", async (request, reply) => {
    const authedRequest = request as AuthedRequest;
    const user = ensureAdmin(authedRequest, reply);
    if (!user) {
      return;
    }
    const orgId = resolveOrgId(authedRequest, user, reply);
    if (!orgId) {
      return;
    }

    const org = await deps.prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, createdAt: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "org_not_found" });
    }

    const [users, bankLines] = await Promise.all([
      deps.prisma.user.findMany({
        where: { orgId },
        select: { id: true, email: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      deps.prisma.bankLine.findMany({
        where: { orgId },
        select: {
          id: true,
          date: true,
          amount: true,
          payee: true,
          desc: true,
          createdAt: true,
        },
        orderBy: { date: "desc" },
      }),
    ]);

    return reply.send({
      org,
      users,
      bankLines,
      policies: [],
      gates: [],
      ledger: [],
      reports: [],
    });
  });

  app.delete("/privacy/delete", async (request, reply) => {
    const authedRequest = request as AuthedRequest;
    const user = ensureAdmin(authedRequest, reply);
    if (!user) {
      return;
    }
    const orgId = resolveOrgId(authedRequest, user, reply);
    if (!orgId) {
      return;
    }

    const org = await deps.prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "org_not_found" });
    }

    const flaggedAt = new Date();

    await deps.prisma.org.updateMany({
      where: { id: orgId },
      data: {},
    });
    await deps.prisma.user.updateMany({ where: { orgId }, data: {} });
    await deps.prisma.bankLine.updateMany({ where: { orgId }, data: {} });

    if (deps.prisma.auditBlob) {
      await deps.prisma.auditBlob.create({
        data: {
          orgId,
          kind: "privacy_delete",
          actorId: user.id ?? null,
          createdAt: flaggedAt,
          payload: {},
        },
      });
    }

    return reply.send({ status: "flagged", flaggedAt: flaggedAt.toISOString() });
  });
}
