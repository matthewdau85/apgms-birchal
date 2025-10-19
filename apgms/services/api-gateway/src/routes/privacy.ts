import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { PrivacyAdminRequestSchema, type PrivacyAdminRequest } from "../schemas/privacy";

const ADMIN_HEADER = "x-admin-token";

type UserDelegate = PrismaClient["user"];
type BankLineDelegate = PrismaClient["bankLine"];

export type PrivacyRouteDeps = {
  prisma: {
    user: Pick<UserDelegate, "findFirst" | "update">;
    bankLine: Pick<BankLineDelegate, "findMany" | "updateMany">;
  };
  artifactRoot?: string;
  adminToken?: string;
};

const defaultArtifactRoot = path.resolve(process.cwd(), "artifacts/privacy");

async function ensureArtifactRoot(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function requireAdminToken(
  request: FastifyRequest,
  reply: FastifyReply,
  expectedToken: string
) {
  const rawToken =
    request.headers[ADMIN_HEADER] ??
    request.headers[ADMIN_HEADER.toLowerCase() as keyof typeof request.headers];
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!token || token !== expectedToken) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

async function handleExport(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: PrivacyRouteDeps,
  artifactRoot: string
) {
  const parsed = PrivacyAdminRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const body: PrivacyAdminRequest = parsed.data;
  const [user, bankLines] = await Promise.all([
    deps.prisma.user.findFirst({ where: { orgId: body.orgId, email: body.subjectEmail } }),
    deps.prisma.bankLine.findMany({ where: { orgId: body.orgId }, orderBy: { date: "desc" } }),
  ]);

  const artifactId = randomUUID();
  const artifactPath = path.join(artifactRoot, `${artifactId}.json`);
  const artifact = {
    artifactId,
    generatedAt: new Date().toISOString(),
    orgId: body.orgId,
    subjectEmail: body.subjectEmail,
    user,
    bankLines,
  };
  await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2), "utf8");

  reply.code(200).send({
    artifactId,
    artifactPath,
    bankLineCount: bankLines.length,
    hasUser: Boolean(user),
  });
}

async function handleDelete(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: PrivacyRouteDeps,
  artifactRoot: string
) {
  const parsed = PrivacyAdminRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const body: PrivacyAdminRequest = parsed.data;
  const user = await deps.prisma.user.findFirst({
    where: { orgId: body.orgId, email: body.subjectEmail },
  });

  let anonymizedEmail: string | null = null;
  if (user) {
    anonymizedEmail = `deleted+${user.id}@example.com`;
    await deps.prisma.user.update({
      where: { id: user.id },
      data: {
        email: anonymizedEmail,
        password: "__deleted__",
      },
    });
  }

  const bankLineResult = await deps.prisma.bankLine.updateMany({
    where: { orgId: body.orgId },
    data: { payee: "[deleted]", desc: "[deleted]" },
  });

  const auditId = randomUUID();
  const auditPath = path.join(artifactRoot, `${auditId}-delete.json`);
  const audit = {
    auditId,
    action: "privacy_delete",
    occurredAt: new Date().toISOString(),
    orgId: body.orgId,
    subjectEmail: body.subjectEmail,
    userId: user?.id ?? null,
    anonymizedEmail,
    bankLinesUpdated: bankLineResult.count,
  };

  await fs.writeFile(auditPath, JSON.stringify(audit, null, 2), "utf8");

  reply.code(200).send({
    auditId,
    auditPath,
    anonymized: Boolean(user),
    bankLinesUpdated: bankLineResult.count,
  });
}

export async function registerPrivacyRoutes(app: FastifyInstance, deps: PrivacyRouteDeps) {
  const artifactRoot = deps.artifactRoot ?? defaultArtifactRoot;
  const adminToken = deps.adminToken ?? process.env.ADMIN_PRIVACY_TOKEN ?? "changeme";
  await ensureArtifactRoot(artifactRoot);

  app.post("/admin/privacy/export", async (request, reply) => {
    if (!requireAdminToken(request, reply, adminToken)) {
      return;
    }
    await handleExport(request, reply, deps, artifactRoot);
  });

  app.post("/admin/privacy/delete", async (request, reply) => {
    if (!requireAdminToken(request, reply, adminToken)) {
      return;
    }
    await handleDelete(request, reply, deps, artifactRoot);
  });
}
