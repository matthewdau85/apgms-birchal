import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "../../../../shared/src/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const DraftBodySchema = z.object({
  token: z.string().min(1).optional(),
  orgId: z.string().min(1).optional(),
  data: z
    .record(z.any())
    .optional()
    .transform((value) => (value === undefined ? {} : value)),
});

const OrgSchema = z.object({
  name: z.string().min(1, "Organisation name is required"),
  abn: z
    .string()
    .min(11, "ABN must be 11 digits")
    .max(11, "ABN must be 11 digits")
    .regex(/^[0-9]+$/, "ABN must contain only digits"),
  address: z.string().min(1, "Organisation address is required"),
});

const BankSchema = z.object({
  consentId: z.string().min(1, "Consent identifier is required"),
  status: z.literal("approved", {
    errorMap: () => ({ message: "Consent must be approved before completion" }),
  }),
  provider: z.string().min(1).optional(),
  approvedAt: z.string().optional(),
});

const PoliciesSchema = z.object({
  templateId: z.string().min(1, "Policy template is required"),
  allocations: z
    .object({
      operating: z.number().min(0).max(100),
      tax: z.number().min(0).max(100),
      paygw: z.number().min(0).max(100),
      gst: z.number().min(0).max(100),
    })
    .refine(
      (allocations) =>
        Math.round(
          allocations.operating +
            allocations.tax +
            allocations.paygw +
            allocations.gst
        ) === 100,
      {
        message: "Allocations must add up to 100%",
        path: ["allocations"],
      }
    ),
});

const IntegrationsSchema = z.object({
  xero: z.boolean().optional(),
  qbo: z.boolean().optional(),
  square: z.boolean().optional(),
});

const CompletionSchema = z.object({
  token: z.string().min(1, "Completion requires a token"),
  orgId: z.string().min(1).optional(),
  data: z
    .object({
      org: OrgSchema,
      bank: BankSchema,
      policies: PoliciesSchema,
      integrations: IntegrationsSchema.optional(),
    })
    .partial()
    .optional(),
});

function mergeDraftData(
  existing: Prisma.JsonValue,
  incoming?: Record<string, unknown>
): Record<string, unknown> {
  const base = (existing as Record<string, unknown>) ?? {};
  if (!incoming) {
    return { ...base };
  }

  const next: Record<string, unknown> = { ...base, ...incoming };
  const baseOrg = (base.org as Record<string, unknown> | undefined) ?? {};
  const incomingOrg = (incoming.org as Record<string, unknown> | undefined) ?? {};
  next.org = { ...baseOrg, ...incomingOrg };

  const baseBank = (base.bank as Record<string, unknown> | undefined) ?? {};
  const incomingBank = (incoming.bank as Record<string, unknown> | undefined) ?? {};
  next.bank = { ...baseBank, ...incomingBank };

  const basePolicies = (base.policies as Record<string, unknown> | undefined) ?? {};
  const incomingPolicies = (incoming.policies as Record<string, unknown> | undefined) ?? {};
  next.policies = { ...basePolicies, ...incomingPolicies };

  const baseIntegrations = (base.integrations as Record<string, unknown> | undefined) ?? {};
  const incomingIntegrations = (incoming.integrations as Record<string, unknown> | undefined) ?? {};
  next.integrations = { ...baseIntegrations, ...incomingIntegrations };

  return next;
}

export async function onboardingRoutes(app: FastifyInstance) {
  app.post("/draft", async (req, rep) => {
    const parsed = DraftBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return rep.code(400).send({ error: "invalid_draft", details: parsed.error.flatten() });
    }

    const { token, data, orgId } = parsed.data;

    const payload: Prisma.OnboardingDraftCreateInput = {
      token: token ?? randomUUID(),
      orgId,
      data: (data as Prisma.JsonValue) ?? {},
    };

    try {
      const draft = await prisma.onboardingDraft.upsert({
        where: { token: payload.token },
        update: {
          data: payload.data,
          orgId: payload.orgId,
        },
        create: payload,
      });

      return rep
        .code(token ? 200 : 201)
        .send({
          token: draft.token,
          orgId: draft.orgId,
          data: draft.data,
          updatedAt: draft.updatedAt,
        });
    } catch (error) {
      req.log.error({ error }, "failed to persist onboarding draft");
      return rep.code(500).send({ error: "draft_persist_failed" });
    }
  });

  app.get<{ Params: { token: string } }>("/draft/:token", async (req, rep) => {
    try {
      const draft = await prisma.onboardingDraft.findUnique({
        where: { token: req.params.token },
      });

      if (!draft) {
        return rep.code(404).send({ error: "draft_not_found" });
      }

      return {
        token: draft.token,
        orgId: draft.orgId,
        data: draft.data,
        updatedAt: draft.updatedAt,
      };
    } catch (error) {
      req.log.error({ error }, "failed to load onboarding draft");
      return rep.code(500).send({ error: "draft_lookup_failed" });
    }
  });

  app.post("/complete", async (req, rep) => {
    const parsed = CompletionSchema.safeParse(req.body);
    if (!parsed.success) {
      return rep.code(400).send({ error: "invalid_completion", details: parsed.error.flatten() });
    }

    const { token, data: overrideData, orgId } = parsed.data;

    try {
      const draft = await prisma.onboardingDraft.findUnique({ where: { token } });
      if (!draft) {
        return rep.code(404).send({ error: "draft_not_found" });
      }

      const merged = mergeDraftData(draft.data, overrideData as Record<string, unknown> | undefined);
      if (orgId) {
        merged.org = { ...(merged.org as Record<string, unknown> | undefined), orgId };
      }

      const completionCheck = CompletionSchema.shape.data.unwrap().safeParse(merged);
      if (!completionCheck.success) {
        return rep
          .code(400)
          .send({ error: "draft_incomplete", details: completionCheck.error.flatten() });
      }

      const nowIso = new Date().toISOString();

      await prisma.onboardingDraft.update({
        where: { token },
        data: {
          data: {
            ...merged,
            status: "completed",
            completedAt: nowIso,
          } as Prisma.JsonValue,
        },
      });

      req.log.info(
        {
          token,
          connectors: completionCheck.data.integrations ?? {},
        },
        "Onboarding completed – policies activated, gate opened, connectors primed"
      );

      return { token, status: "completed", completedAt: nowIso };
    } catch (error) {
      req.log.error({ error }, "failed to complete onboarding");
      return rep.code(500).send({ error: "completion_failed" });
    }
  });
}
