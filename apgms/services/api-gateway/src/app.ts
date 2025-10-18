import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  AuditChain,
  PolicyEngine,
  ReplayProtector,
  StaticTokenAuthenticator,
  createDefaultAuthenticator,
  defaultPolicies,
  verifySignature,
} from "@apgms/shared";
import { resolvePrisma } from "@apgms/shared/db";

type BankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
};

type PrismaLike = {
  user: {
    findMany: (args: { select: Record<string, boolean>; orderBy: { createdAt: "desc" } }) => Promise<
      { email: string; orgId: string; createdAt: Date }[]
    >;
  };
  bankLine: {
    findMany: (args: { orderBy: { date: "desc" }; take: number }) => Promise<BankLine[]>;
    create: (args: { data: Omit<BankLine, "id"> }) => Promise<BankLine>;
  };
};

export interface AppDependencies {
  prisma: PrismaLike;
  policyEngine: PolicyEngine;
  replayProtector: ReplayProtector;
  auditChain: AuditChain;
  authenticator: StaticTokenAuthenticator;
  webhookSecret: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      tokenId: string;
      subject: string;
      orgId: string;
      roles: string[];
    };
  }
}

async function resolveDependencies(overrides?: Partial<AppDependencies>): Promise<AppDependencies> {
  const authenticator =
    overrides?.authenticator ??
    createDefaultAuthenticator();

  return {
    prisma: overrides?.prisma ?? ((await resolvePrisma()) as PrismaLike),
    policyEngine: overrides?.policyEngine ?? new PolicyEngine(defaultPolicies),
    replayProtector: overrides?.replayProtector ?? new ReplayProtector(),
    auditChain: overrides?.auditChain ?? new AuditChain(),
    authenticator,
    webhookSecret: overrides?.webhookSecret ?? process.env.WEBHOOK_SECRET ?? "local-webhook",
  };
}

export async function createApp(overrides?: Partial<AppDependencies>): Promise<FastifyInstance> {
  const deps = await resolveDependencies(overrides);
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.addHook("preHandler", async (request, reply) => {
    const routeConfig = request.routeOptions.config ?? {};
    if ((routeConfig as any).public === true) {
      return;
    }
    const result = deps.authenticator.verify(request.headers);
    if (!result.ok) {
      return reply.code(result.status ?? 401).send({ error: result.error });
    }
    request.auth = result.principal;
  });

  app.get("/health", { config: { public: true } }, async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async (request) => {
    const auth = request.auth!;
    const users = await deps.prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const scoped = users.filter((user) => user.orgId === auth.orgId);
    return { users: scoped };
  });

  app.get("/bank-lines", async (request, reply) => {
    const auth = request.auth!;
    const take = Number((request.query as Record<string, unknown>).take ?? 20);
    const normalizedTake = Math.min(Math.max(take, 1), 200);
    const decision = deps.policyEngine.evaluate("bank-line:list", {
      actor: auth.subject,
      actorOrgId: auth.orgId,
      orgId: auth.orgId,
      roles: auth.roles,
    });

    if (decision.decision !== "allow") {
      return reply.code(403).send({ error: "policy_denied", reasons: decision.reasons });
    }

    const lines = await deps.prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: normalizedTake,
    });
    const scoped = lines.filter((line) => line.orgId === auth.orgId);
    return { lines: scoped };
  });

  app.post("/bank-lines", async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      orgId: string;
      date: string;
      amount: number;
      payee: string;
      desc: string;
    };

    const ledgerBalance = (request.headers["x-ledger-balance"]
      ? Number(request.headers["x-ledger-balance"])
      : undefined) ?? 0;

    const decision = deps.policyEngine.evaluate("bank-line:create", {
      actor: auth.subject,
      actorOrgId: auth.orgId,
      orgId: body.orgId,
      amount: body.amount,
      ledgerBalance,
      roles: auth.roles,
    });

    if (decision.decision !== "allow") {
      const reasons = decision.invariantViolations.length
        ? decision.invariantViolations
        : decision.reasons;
      return reply.code(403).send({ error: "policy_denied", reasons });
    }

    try {
      const created = await deps.prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount,
          payee: body.payee,
          desc: body.desc,
        },
      });
      deps.auditChain.append({
        id: created.id,
        actor: auth.subject,
        orgId: created.orgId,
        payload: {
          amount: created.amount,
          payee: created.payee,
          desc: created.desc,
        },
        timestamp: Date.now(),
      });
      return reply.code(201).send(created);
    } catch (error) {
      request.log.error({ err: error }, "failed to create bank line");
      return reply.code(400).send({ error: "bad_request" });
    }
  });

  app.post(
    "/webhooks/bank-events",
    { config: { public: true } },
    async (request, reply) => {
      const body = request.body as { id: string; orgId: string; payload: Record<string, unknown>; timestamp: number };
      const signature = request.headers["x-webhook-signature"];

      if (!verifySignature(body, deps.webhookSecret, signature)) {
        return reply.code(401).send({ error: "invalid_signature" });
      }

      const replay = deps.replayProtector.check(body.id, body.timestamp);
      if (!replay.ok) {
        return reply.code(409).send({ error: replay.reason });
      }

      deps.auditChain.append({
        id: `webhook-${body.id}`,
        actor: "webhook",
        orgId: body.orgId,
        payload: body.payload,
        timestamp: body.timestamp,
      });

      return reply.code(202).send({ accepted: true });
    },
  );

  app.get("/audit/verify", async (request) => {
    const result = deps.auditChain.verify();
    return result;
  });

  return app;
}
