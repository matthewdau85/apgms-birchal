import crypto from "node:crypto";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
type AdminPrivacyOptions = {
  prisma: any;
};

type AdminRequest = FastifyRequest & {
  headers: FastifyRequest["headers"] & { "x-role"?: string; "x-actor"?: string };
};

const adminOnly = async (req: AdminRequest, rep: FastifyReply) => {
  if (req.headers["x-role"] !== "admin") {
    return rep.code(403).send({ error: "forbidden" });
  }
};

const getQuerySchema = z.object({ orgId: z.string().min(1) });
const deleteBodySchema = z.object({ orgId: z.string().min(1), hard: z.boolean().optional() });

const hashValue = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const adminPrivacyRoutes: FastifyPluginAsync<AdminPrivacyOptions> = async (
  app,
  { prisma }
) => {
  app.get("/admin/export", { preHandler: adminOnly }, async (req, rep) => {
    const { orgId } = getQuerySchema.parse(req.query);

    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      return rep.code(404).send({ error: "not_found" });
    }

    const [users, bankLines, rpts] = await Promise.all([
      prisma.user.findMany({ where: { orgId } }),
      prisma.bankLine.findMany({ where: { orgId } }),
      prisma.rpt.findMany({ where: { orgId } }),
    ]);

    return rep.send({ org, users, bankLines, rpts });
  });

  app.post("/admin/delete", { preHandler: adminOnly }, async (req, rep) => {
    const { orgId, hard } = deleteBodySchema.parse(req.body);
    const now = new Date();

    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      return rep.code(404).send({ error: "not_found" });
    }

    if (hard) {
      await prisma.org.update({ where: { id: orgId }, data: { name: hashValue(org.name), deletedAt: now } });

      const users = await prisma.user.findMany({ where: { orgId } });
      await Promise.all(
        users.map((user) =>
          prisma.user.update({
            where: { id: user.id },
            data: {
              email: hashValue(user.email),
              password: hashValue(user.password),
              deletedAt: now,
            },
          })
        )
      );

      const lines = await prisma.bankLine.findMany({ where: { orgId } });
      await Promise.all(
        lines.map((line) =>
          prisma.bankLine.update({
            where: { id: line.id },
            data: {
              payee: hashValue(line.payee),
              desc: hashValue(line.desc),
              deletedAt: now,
            },
          })
        )
      );

      const reports = await prisma.rpt.findMany({ where: { orgId } });
      await Promise.all(
        reports.map((report) =>
          prisma.rpt.update({
            where: { id: report.id },
            data: {
              kind: hashValue(report.kind),
              payloadHash: hashValue(report.payloadHash),
              deletedAt: now,
            },
          })
        )
      );
    } else {
      await Promise.all([
        prisma.org.update({ where: { id: orgId }, data: { deletedAt: now } }),
        prisma.user.updateMany({ where: { orgId }, data: { deletedAt: now } }),
        prisma.bankLine.updateMany({ where: { orgId }, data: { deletedAt: now } }),
        prisma.rpt.updateMany({ where: { orgId }, data: { deletedAt: now } }),
      ]);
    }

    await prisma.auditEvent.create({
      data: {
        orgId,
        action: hard ? "org.delete.hard" : "org.delete.soft",
        actor: req.headers["x-actor"] ?? "system",
        payload: { hard: Boolean(hard) },
      },
    });

    return rep.send({ ok: true });
  });
};

export default adminPrivacyRoutes;
