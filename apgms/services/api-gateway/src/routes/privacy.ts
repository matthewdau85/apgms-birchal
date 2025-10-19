import type { FastifyInstance } from "fastify";
import { ensureAdmin } from "../lib/admin";
import { prisma, writeAuditBlob } from "@apgms/shared";

export default async function registerPrivacyRoutes(app: FastifyInstance) {
  app.get("/export/:orgId", async (req, reply) => {
    try {
      ensureAdmin(req, reply);
    } catch (err) {
      return reply.send({ error: "admin_required" });
    }

    const { orgId } = req.params as { orgId: string };
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: {
        users: true,
        lines: true,
        agreements: true,
        remittances: true,
      },
    });

    if (!org) {
      return reply.code(404).send({ error: "org_not_found" });
    }

    return reply.send({
      org: {
        id: org.id,
        name: org.name,
        createdAt: org.createdAt,
      },
      users: org.users
        .filter((u) => !u.deletedAt)
        .map(({ id, email, createdAt }) => ({ id, email, createdAt })),
      bankLines: org.lines
        .filter((l) => !l.deletedAt)
        .map(({ id, date, amount, payee, desc }) => ({
          id,
          date,
          amount,
          payee,
          desc,
        })),
      agreements: org.agreements,
      remittances: org.remittances,
    });
  });

  app.post("/delete/:orgId", async (req, reply) => {
    try {
      ensureAdmin(req, reply);
    } catch (err) {
      return reply.send({ error: "admin_required" });
    }

    const { orgId } = req.params as { orgId: string };
    const now = new Date();

    const userResult = await prisma.user.updateMany({
      where: { orgId, deletedAt: null },
      data: { deletedAt: now },
    });

    const bankResult = await prisma.bankLine.updateMany({
      where: { orgId, deletedAt: null },
      data: { deletedAt: now, payee: "REDACTED", desc: "REDACTED" },
    });

    await writeAuditBlob({
      scope: "privacy.delete",
      orgId,
      payload: {
        usersSoftDeleted: userResult.count,
        bankLinesSoftDeleted: bankResult.count,
        deletedAt: now.toISOString(),
      },
    });

    return reply.send({
      orgId,
      usersSoftDeleted: userResult.count,
      bankLinesSoftDeleted: bankResult.count,
    });
  });
}
