import { promises as fs } from "node:fs";
import path from "node:path";

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { PrismaClient } from "@prisma/client";

type OrgClient = Pick<PrismaClient, "org">;

export interface AdminPrivacyDependencies {
  prisma: OrgClient;
  adminToken?: string;
  exportDir: string;
}

const ADMIN_HEADER = "x-admin-token";

const isPrismaNotFoundError = (err: unknown): boolean => {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
  );
};

export const registerAdminPrivacyRoutes = (
  app: FastifyInstance,
  deps: AdminPrivacyDependencies
) => {
  app.register(
    async (adminScope, _opts: FastifyPluginOptions) => {
      adminScope.addHook("preHandler", async (req, rep) => {
        const configuredToken = deps.adminToken;
        if (!configuredToken) {
          req.log.error("missing ADMIN_API_TOKEN env");
          return rep.code(500).send({ error: "admin_token_not_configured" });
        }

        const rawHeader = req.headers[ADMIN_HEADER] ?? req.headers["x-admin-token"];
        const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
        if (headerToken !== configuredToken) {
          return rep.code(401).send({ error: "unauthorized" });
        }
      });

      adminScope.post<{ Params: { orgId: string } }>(
        "/export/:orgId",
        async (req, rep) => {
          const orgId = req.params.orgId;

          const record = await deps.prisma.org.findUnique({
            where: { id: orgId },
            include: {
              users: true,
              lines: { orderBy: { date: "asc" } },
            },
          });

          if (!record) {
            return rep.code(404).send({ error: "org_not_found" });
          }

          const exportedAt = new Date();
          const bundle = {
            exportedAt: exportedAt.toISOString(),
            org: {
              id: record.id,
              name: record.name,
              createdAt: record.createdAt.toISOString(),
              deletedAt: record.deletedAt?.toISOString() ?? null,
              piiRedactedAt: record.piiRedactedAt?.toISOString() ?? null,
            },
            users: record.users.map((user) => ({
              id: user.id,
              email: user.email,
              createdAt: user.createdAt.toISOString(),
            })),
            bankLines: record.lines.map((line) => ({
              id: line.id,
              date: line.date.toISOString(),
              amount: typeof (line as any).amount?.toString === "function"
                ? (line as any).amount.toString()
                : String((line as any).amount ?? "0"),
              payee: line.payee,
              desc: line.desc,
              createdAt: line.createdAt.toISOString(),
            })),
          };

          await fs.mkdir(deps.exportDir, { recursive: true });
          const fileName = `${record.id}-${exportedAt.toISOString().replace(/[:.]/g, "-")}.json`;
          const targetPath = path.join(deps.exportDir, fileName);
          await fs.writeFile(targetPath, JSON.stringify(bundle, null, 2), "utf8");

          return bundle;
        }
      );

      adminScope.post<{ Params: { orgId: string } }>(
        "/delete/:orgId",
        async (req, rep) => {
          const orgId = req.params.orgId;
          const now = new Date();

          try {
            const updated = await deps.prisma.org.update({
              where: { id: orgId },
              data: {
                deletedAt: now,
                piiRedactedAt: now,
              },
            });

            return {
              org: {
                id: updated.id,
                deletedAt: updated.deletedAt?.toISOString() ?? null,
                piiRedactedAt: updated.piiRedactedAt?.toISOString() ?? null,
              },
            };
          } catch (err) {
            if (isPrismaNotFoundError(err)) {
              return rep.code(404).send({ error: "org_not_found" });
            }

            throw err;
          }
        }
      );
    },
    { prefix: "/admin" }
  );
};
