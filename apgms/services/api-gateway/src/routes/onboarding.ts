import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { zOrgProfile, zBank, zPolicySelect } from "../schemas/onboarding";

export type OnboardingState = {
  profile?: {
    legalName: string;
    abn?: string;
    contactEmail: string;
  };
  bank?: {
    bsbMasked: string;
    accMasked: string;
  };
  policyId?: string;
};

export type AuditBlob = {
  id: string;
  orgId: string;
  kind: "onboarding.bankMasked" | "onboarding.policySelected";
  createdAt: string;
  payload: Record<string, unknown>;
};

const onboardingStore = new Map<string, OnboardingState>();
const auditBlobs: AuditBlob[] = [];

const maskValue = (value: string, visible = 2) => {
  const keep = Math.max(0, Math.min(value.length, visible));
  const hidden = Math.max(0, value.length - keep);
  return `${"*".repeat(hidden)}${value.slice(value.length - keep)}`;
};

const getOrgId = (req: FastifyRequest): string => {
  const headerValue = req.headers["x-org-id"];
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue;
  }
  return "demo-org";
};

const getState = (orgId: string): OnboardingState => {
  if (!onboardingStore.has(orgId)) {
    onboardingStore.set(orgId, {});
  }
  return onboardingStore.get(orgId)!;
};

export const registerOnboardingRoutes = async (app: FastifyInstance) => {
  app.patch("/onboarding/profile", async (req, rep) => {
    const orgId = getOrgId(req);
    const parsed = zOrgProfile.safeParse(req.body);

    if (!parsed.success) {
      return rep.code(400).send({ error: "invalid_profile", details: parsed.error.format() });
    }

    const state = getState(orgId);
    state.profile = parsed.data;

    return { profile: state.profile };
  });

  app.post("/onboarding/bank", async (req, rep) => {
    const orgId = getOrgId(req);
    const parsed = zBank.safeParse(req.body);

    if (!parsed.success) {
      return rep.code(400).send({ error: "invalid_bank", details: parsed.error.format() });
    }

    const { bsb, acc } = parsed.data;
    const bsbMasked = maskValue(bsb, 2);
    const accMasked = maskValue(acc, 3);

    const state = getState(orgId);
    state.bank = { bsbMasked, accMasked };

    auditBlobs.push({
      id: randomUUID(),
      orgId,
      kind: "onboarding.bankMasked",
      createdAt: new Date().toISOString(),
      payload: state.bank,
    });

    return { bank: state.bank };
  });

  app.post("/onboarding/policy", async (req, rep) => {
    const orgId = getOrgId(req);
    const parsed = zPolicySelect.safeParse(req.body);

    if (!parsed.success) {
      return rep.code(400).send({ error: "invalid_policy", details: parsed.error.format() });
    }

    const state = getState(orgId);
    state.policyId = parsed.data.policyId;

    auditBlobs.push({
      id: randomUUID(),
      orgId,
      kind: "onboarding.policySelected",
      createdAt: new Date().toISOString(),
      payload: { policyId: parsed.data.policyId },
    });

    return { policyId: state.policyId };
  });

  app.get("/onboarding", async (req) => {
    const orgId = getOrgId(req);
    return { state: getState(orgId) };
  });

  app.get("/policies", async () => {
    return {
      policies: [
        { id: "standard", name: "Standard Protection", description: "Baseline coverage for new partners." },
        { id: "growth", name: "Growth Accelerator", description: "Enhanced coverage tailored for scaling orgs." },
        { id: "enterprise", name: "Enterprise Shield", description: "Premium coverage for complex operations." },
      ],
    };
  });

  app.get("/audit-blobs", async () => ({ audit: auditBlobs }));
};
