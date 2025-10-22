import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import type { Org, User, BankLine, PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";
import { bankLineInput } from "./schemas/bankLine";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      orgId: string;
    };
  }
}

const ADMIN_HEADER = "x-admin-token";

export interface CreateAppOptions {
  prisma?: PrismaClient;
}

export interface AdminOrgExport {
  org: {
    id: string;
    name: string;
    createdAt: string;
    deletedAt: string | null;
  };
  users: Array<{
    id: string;
    email: string;
    createdAt: string;
  }>;
  bankLines: Array<{
    id: string;
    externalId: string;
    occurredAt: string;
    amountCents: number;
    description: string | null;
    createdAt: string;
  }>;
}

type ExportableOrg = Org & { users: User[]; lines: BankLine[] };

type PrismaLike = Pick<
  PrismaClient,
  | "org"
  | "user"
  | "bankLine"
  | "orgTombstone"
  | "$transaction"
>;

let cachedPrisma: PrismaClient | null = null;

async function loadDefaultPrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = (await import("@apgms/shared/src/db")) as { prisma: PrismaClient };
    cachedPrisma = module.prisma;
  }
  return cachedPrisma as PrismaLike;
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const prisma = (options.prisma as PrismaLike | undefined) ?? (await loadDefaultPrisma());

  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { occurredAt: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });

    return {
      lines: lines.map((line) => ({
        id: line.id,
        orgId: line.orgId,
        externalId: line.externalId,
        amountCents: line.amountCents,
        occurredAt: line.occurredAt.toISOString(),
        description: line.description,
        createdAt: line.createdAt.toISOString(),
      })),
    };
  });

  app.post("/bank-lines", async (req, rep) => {
    const principal = parsePrincipal(req);
    if (!principal) {
      return rep.code(401).send({ error: "unauthorized" });
    }

    const idempotencyKey = req.headers["idempotency-key"] ?? req.headers["Idempotency-Key" as keyof typeof req.headers];
    const headerValue = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;
    if (!headerValue || typeof headerValue !== "string" || !headerValue.trim()) {
      return rep.code(400).send({ error: "idempotency_key_required" });
    }

    const parsed = bankLineInput.safeParse(req.body);
    if (!parsed.success) {
      return rep.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { externalId, occurredAt, description, amountCents } = parsed.data;
      const row = await prisma.bankLine.upsert({
        where: { orgId_externalId: { orgId: principal.orgId, externalId } },
        create: {
          orgId: principal.orgId,
          externalId,
          amountCents,
          occurredAt: new Date(occurredAt),
          description: description ?? null,
        },
        update: {},
      });

      return rep.code(200).send({ id: row.id });
    } catch (e) {
      req.log.error({ err: maskError(e) }, "failed to create bank line");
      return rep.code(409).send({ error: "duplicate" });
    }
  });

  app.get("/admin/export/:orgId", async (req, rep) => {
    if (!requireAdmin(req, rep)) {
      return;
    }
    const { orgId } = req.params as { orgId: string };
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: { users: true, lines: true },
    });
    if (!org) {
      return rep.code(404).send({ error: "org_not_found" });
    }

    const exportPayload = buildOrgExport(org as ExportableOrg);
    return rep.send({ export: exportPayload });
  });

  app.delete("/admin/delete/:orgId", async (req, rep) => {
    if (!requireAdmin(req, rep)) {
      return;
    }
    const { orgId } = req.params as { orgId: string };
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: { users: true, lines: true },
    });
    if (!org) {
      return rep.code(404).send({ error: "org_not_found" });
    }
    if (org.deletedAt) {
      return rep.code(409).send({ error: "already_deleted" });
    }

    const exportPayload = buildOrgExport(org as ExportableOrg);
    const deletedAt = new Date();
    const tombstonePayload: AdminOrgExport = {
      ...exportPayload,
      org: { ...exportPayload.org, deletedAt: deletedAt.toISOString() },
    };

    await prisma.$transaction(async (tx) => {
      await tx.org.update({
        where: { id: orgId },
        data: { deletedAt },
      });
      await tx.user.deleteMany({ where: { orgId } });
      await tx.bankLine.deleteMany({ where: { orgId } });
      await tx.orgTombstone.create({
        data: {
          orgId,
          payload: tombstonePayload,
        },
      });
    });

    return rep.send({ status: "deleted", deletedAt: deletedAt.toISOString() });
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

function requireAdmin(req: FastifyRequest, rep: FastifyReply): boolean {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    req.log.error("ADMIN_TOKEN is not configured");
    void rep.code(500).send({ error: "admin_config_missing" });
    return false;
  }

  const provided = req.headers[ADMIN_HEADER] ?? req.headers[ADMIN_HEADER.toUpperCase() as keyof typeof req.headers];
  const providedValue = Array.isArray(provided) ? provided[0] : provided;

  if (providedValue !== configuredToken) {
    void rep.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

function buildOrgExport(org: ExportableOrg): AdminOrgExport {
  return {
    org: {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      deletedAt: org.deletedAt ? org.deletedAt.toISOString() : null,
    },
    users: org.users.map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    })),
    bankLines: org.lines.map((line) => ({
      id: line.id,
      externalId: line.externalId,
      occurredAt: line.occurredAt.toISOString(),
      amountCents: line.amountCents,
      description: line.description ?? null,
      createdAt: line.createdAt.toISOString(),
    })),
  };
}

function parsePrincipal(req: FastifyRequest): { orgId: string } | null {
  const header = req.headers.authorization ?? req.headers["Authorization" as keyof typeof req.headers];
  if (!header || Array.isArray(header)) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return null;
  }

  const token = match[1];
  const [, , orgId] = token.split(":");
  if (!orgId) {
    return null;
  }

  const trimmedOrgId = orgId.trim();
  if (!trimmedOrgId) {
    return null;
  }

  (req as FastifyRequest & { user: { orgId: string } }).user = { orgId: trimmedOrgId };
  return { orgId: trimmedOrgId };
}
