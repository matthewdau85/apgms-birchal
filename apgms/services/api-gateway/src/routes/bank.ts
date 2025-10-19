import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  createConsentRequestSchema,
  createConsentResponseSchema,
  createMandateRequestSchema,
  createMandateResponseSchema,
  getConsentResponseSchema,
  getMandateResponseSchema,
} from "../schemas/payto";
import { createConsent, createMandate } from "../adapters/payto/sandbox";
import { prisma } from "../../../shared/src/db";

const AUTH_TOKEN = process.env.PAYTO_SANDBOX_TOKEN ?? "sandbox-token";

type AuthResult = { orgId: string };

async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
  expectedOrgId?: string,
): Promise<AuthResult | undefined> {
  const authHeader = req.headers["authorization"];
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    reply.code(401);
    reply.send({ error: "unauthorized" });
    return;
  }
  const token = authHeader.substring("Bearer ".length).trim();
  if (token !== AUTH_TOKEN) {
    reply.code(403);
    reply.send({ error: "forbidden" });
    return;
  }
  const orgHeader = req.headers["x-org-id"];
  if (typeof orgHeader !== "string" || !orgHeader) {
    reply.code(400);
    reply.send({ error: "missing_org" });
    return;
  }
  if (expectedOrgId && expectedOrgId !== orgHeader) {
    reply.code(403);
    reply.send({ error: "forbidden" });
    return;
  }
  return { orgId: orgHeader };
}

export const bankRoutes: FastifyPluginAsync = async (app) => {
  app.post("/consents", async (req, reply) => {
    const parsed = createConsentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return reply.send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const auth = await authenticate(req, reply, parsed.data.orgId);
    if (!auth) return;

    const org = await prisma.org.findUnique({ where: { id: parsed.data.orgId } });
    if (!org) {
      reply.code(404);
      return reply.send({ error: "org_not_found" });
    }

    const created = await prisma.bankConnection.create({
      data: {
        orgId: parsed.data.orgId,
        bank: parsed.data.bank,
        accountRef: parsed.data.accountRef,
        status: "PENDING",
      },
    });

    const sandboxConsent = await createConsent(parsed.data);

    const response = createConsentResponseSchema.parse({
      id: created.id,
      status: created.status,
      next: {
        type: "redirect",
        url: sandboxConsent.redirectUrl,
        expiresAt: sandboxConsent.expiresAt,
      },
    });

    return reply.code(201).send(response);
  });

  app.get<{ Params: { id: string } }>("/consents/:id", async (req, reply) => {
    const auth = await authenticate(req, reply);
    if (!auth) return;

    const consent = await prisma.bankConnection.findUnique({ where: { id: req.params.id } });
    if (!consent) {
      reply.code(404);
      return reply.send({ error: "consent_not_found" });
    }
    if (consent.orgId !== auth.orgId) {
      reply.code(403);
      return reply.send({ error: "forbidden" });
    }

    const response = getConsentResponseSchema.parse({
      id: consent.id,
      status: consent.status,
    });
    return reply.send(response);
  });

  app.post("/mandates", async (req, reply) => {
    const parsed = createMandateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return reply.send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const auth = await authenticate(req, reply, parsed.data.orgId);
    if (!auth) return;

    const connection = await prisma.bankConnection.findUnique({ where: { id: parsed.data.bankConnectionId } });
    if (!connection) {
      reply.code(404);
      return reply.send({ error: "bank_connection_not_found" });
    }
    if (connection.orgId !== auth.orgId) {
      reply.code(403);
      return reply.send({ error: "forbidden" });
    }

    const created = await prisma.payToMandate.create({
      data: {
        orgId: parsed.data.orgId,
        bankConnectionId: parsed.data.bankConnectionId,
        reference: parsed.data.reference,
        status: "PENDING",
        amountLimitCents: parsed.data.amountLimitCents,
        startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
        endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      },
    });

    const sandboxMandate = await createMandate({
      orgId: parsed.data.orgId,
      bankConnectionId: parsed.data.bankConnectionId,
      reference: parsed.data.reference,
      amountLimitCents: parsed.data.amountLimitCents,
    });

    const response = createMandateResponseSchema.parse({
      id: created.id,
      status: created.status,
      nextEvent: sandboxMandate.nextEvent,
    });

    return reply.code(201).send(response);
  });

  app.get<{ Params: { id: string } }>("/mandates/:id", async (req, reply) => {
    const auth = await authenticate(req, reply);
    if (!auth) return;

    const mandate = await prisma.payToMandate.findUnique({ where: { id: req.params.id } });
    if (!mandate) {
      reply.code(404);
      return reply.send({ error: "mandate_not_found" });
    }
    if (mandate.orgId !== auth.orgId) {
      reply.code(403);
      return reply.send({ error: "forbidden" });
    }

    const latestAudit = await prisma.auditBlob.findFirst({
      where: { orgId: auth.orgId, subjectType: "mandate", subjectId: mandate.id },
      orderBy: { createdAt: "desc" },
    });

    const response = getMandateResponseSchema.parse({
      id: mandate.id,
      status: mandate.status,
      latestEvent: latestAudit
        ? {
            kind: latestAudit.kind,
            occurredAt: latestAudit.createdAt.toISOString(),
            payload: latestAudit.payload as Record<string, unknown>,
          }
        : null,
    });

    return reply.send(response);
  });
};
