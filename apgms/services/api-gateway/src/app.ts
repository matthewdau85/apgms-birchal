import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createFileKMS, type KeyManagementService } from "../../../shared/crypto/kms";
import { prisma as defaultPrisma, type PrismaClientLike, appendAuditLog } from "@apgms/shared";
import { registerSecurity, type Role } from "./security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppOptions {
  prisma?: PrismaClientLike;
  kms?: KeyManagementService;
  roleTokens?: Partial<Record<Role, string>>;
  rateLimit?: {
    max: number;
    intervalMs: number;
  };
}

function resolveRoleTokens(overrides?: Partial<Record<Role, string>>): Record<Role, string> {
  return {
    admin: overrides?.admin ?? process.env.ADMIN_TOKEN ?? "admin-token",
    operator: overrides?.operator ?? process.env.OPERATOR_TOKEN ?? "operator-token",
    auditor: overrides?.auditor ?? process.env.AUDITOR_TOKEN ?? "auditor-token",
  };
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const kms = options.kms ?? (await createFileKMS(path.resolve(__dirname, "../../../kms-state.json")));
  const prisma = options.prisma ?? defaultPrisma;
  const rateLimit = options.rateLimit ?? {
    max: Number(process.env.RATE_LIMIT_MAX ?? 60),
    intervalMs: Number(process.env.RATE_LIMIT_INTERVAL_MS ?? 60_000),
  };

  registerSecurity(app, {
    kms,
    roleTokens: resolveRoleTokens(options.roleTokens),
    rateLimit,
  });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get(
    "/users",
    {
      preHandler: [app.requireRole(["admin", "auditor"])] as any,
    },
    async () => {
      const users = await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return { users };
    },
  );

  app.get(
    "/bank-lines",
    {
      preHandler: [app.requireRole(["admin", "operator", "auditor"])] as any,
    },
    async (req) => {
      const take = Number((req.query as any)?.take ?? 20);
      const lines = await prisma.bankLine.findMany({
        orderBy: { date: "desc" },
        take: Math.min(Math.max(take, 1), 200),
      });
      return { lines };
    },
  );

  app.post(
    "/bank-lines",
    {
      preHandler: [app.requireRole(["admin", "operator"]), app.requireCsrf()] as any,
    },
    async (req, rep) => {
      try {
        const body = req.body as {
          orgId: string;
          date: string;
          amount: number | string;
          payee: string;
          desc: string;
        };
        const created = await prisma.bankLine.create({
          data: {
            orgId: body.orgId,
            date: new Date(body.date),
            amount: body.amount as any,
            payee: body.payee,
            desc: body.desc,
          },
        });
        if (req.auth) {
          await appendAuditLog(prisma, {
            actorRole: req.auth.role,
            action: "bank_line:create",
            resource: created.id,
            metadata: { orgId: body.orgId, amount: body.amount },
          });
        }
        return rep.code(201).send(created);
      } catch (err) {
        req.log.error(err);
        return rep.code(400).send({ error: "bad_request" });
      }
    },
  );

  app.decorate("prisma", prisma);
  app.decorate("kms", kms);

  return app;
}
