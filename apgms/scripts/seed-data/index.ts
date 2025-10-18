import {
  RandomGenerator,
  createSeedRandom,
  randomInt,
  randomNumber,
  randomPastDate,
  randomPick,
  slugify,
  toCurrency,
} from "./helpers";

export type PolicyStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface PolicySeed {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: PolicyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyGateSeed {
  id: string;
  policyId: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  createdAt: Date;
}

export interface BankLineSeed {
  id: string;
  orgId: string;
  date: Date;
  amount: string;
  payee: string;
  desc: string;
  createdAt: Date;
}

export interface AllocationSeed {
  id: string;
  bankLineId: string;
  category: string;
  amount: string;
  notes?: string;
  createdAt: Date;
}

export interface AuditEventSeed {
  id: string;
  orgId: string;
  actor: string;
  actorType: string;
  action: string;
  entityType: "policy" | "allocation" | "bank_line";
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SeedData {
  policies: PolicySeed[];
  gates: PolicyGateSeed[];
  bankLines: BankLineSeed[];
  allocations: AllocationSeed[];
  auditEvents: AuditEventSeed[];
}

const POLICY_TEMPLATES = [
  {
    name: "Spending Guardrails",
    description: "Escalate review on large supplier and unusual weekend spend.",
    gateTemplates: [
      { type: "amount_threshold", name: "Large amount review", min: 3500, max: 7500 },
      { type: "weekend_block", name: "Weekend payments", min: 0, max: 0 },
    ],
  },
  {
    name: "Vendor Risk Checks",
    description: "Require due diligence for new or offshore vendors.",
    gateTemplates: [
      { type: "vendor_history", name: "First time vendor", min: 0, max: 0 },
      { type: "jurisdiction", name: "Foreign jurisdiction", min: 0, max: 0 },
    ],
  },
];

const PAYEES = [
  "Acme Fabrication",
  "Skyline Cloud",
  "Birchal Capital",
  "Southbank Studios",
  "Office Collective",
  "Metro Utilities",
  "Courier & Co",
  "Brightline Consulting",
  "Harbour Events",
];

const EXPENSE_DESCRIPTIONS = [
  "Software subscription",
  "Office rent",
  "Digital marketing campaign",
  "Equipment purchase",
  "Professional services",
  "Travel reimbursement",
  "Insurance premium",
];

const INCOME_DESCRIPTIONS = [
  "Investor funds received",
  "Client project milestone",
  "Platform revenue share",
];

const CATEGORIES = [
  "Operations",
  "Marketing",
  "Technology",
  "People",
  "Compliance",
  "Capital",
];

const ALLOCATION_NOTES = [
  "Approved by finance",
  "Split across teams",
  "Pending reconciliation",
  "Auto categorised",
  "Adjusted for FX",
];

const ACTORS = [
  { actor: "system", actorType: "SYSTEM" },
  { actor: "jane.cfo@demo.org", actorType: "USER" },
  { actor: "alex.controller@demo.org", actorType: "USER" },
];

const AUDIT_ACTIONS = [
  "POLICY_ACTIVATED",
  "POLICY_GATE_TRIGGERED",
  "ALLOCATION_CREATED",
  "BANK_LINE_IMPORTED",
  "ALLOCATION_CONFIRMED",
];

const ensurePolicyStatus = (rng: RandomGenerator): PolicyStatus => {
  const statuses: PolicyStatus[] = ["ACTIVE", "ACTIVE", "INACTIVE"];
  return randomPick(statuses, rng);
};

const buildPolicies = (orgId: string, rng: RandomGenerator) => {
  const policies: PolicySeed[] = [];
  const gates: PolicyGateSeed[] = [];

  POLICY_TEMPLATES.forEach((template) => {
    const policyId = `${orgId}-policy-${slugify(template.name)}`;
    const createdAt = randomPastDate(45, rng);
    policies.push({
      id: policyId,
      orgId,
      name: template.name,
      description: template.description,
      status: ensurePolicyStatus(rng),
      createdAt,
      updatedAt: createdAt,
    });

    template.gateTemplates.forEach((gateTemplate, gateIndex) => {
      // Randomly decide if the gate is enabled, keep at least one per policy
      const includeGate = gateIndex === 0 || rng() > 0.25;
      if (!includeGate) return;

      const gateId = `${policyId}-gate-${gateIndex + 1}-${slugify(gateTemplate.name)}`;
      const config = {
        threshold: gateTemplate.max > gateTemplate.min ? Number(toCurrency(randomNumber(gateTemplate.min, gateTemplate.max, rng))) : undefined,
        windowDays: randomInt(3, 14, rng),
      } satisfies Record<string, unknown>;

      gates.push({
        id: gateId,
        policyId,
        name: gateTemplate.name,
        type: gateTemplate.type,
        config,
        createdAt: randomPastDate(30, rng),
      });
    });
  });

  return { policies, gates };
};

const buildBankLines = (orgId: string, rng: RandomGenerator) => {
  const lines: BankLineSeed[] = [];

  const lineCount = randomInt(8, 12, rng);
  for (let index = 0; index < lineCount; index += 1) {
    const payee = randomPick(PAYEES, rng);
    const isIncome = rng() > 0.7;
    const description = isIncome ? randomPick(INCOME_DESCRIPTIONS, rng) : randomPick(EXPENSE_DESCRIPTIONS, rng);
    const amountBase = isIncome ? randomNumber(4000, 15000, rng) : randomNumber(120, 4200, rng);
    const amount = isIncome ? amountBase : -amountBase;
    const date = randomPastDate(20, rng);
    const id = `${orgId}-line-${index + 1}-${slugify(payee)}`;

    lines.push({
      id,
      orgId,
      date,
      amount: toCurrency(amount),
      payee,
      desc: description,
      createdAt: date,
    });
  }

  return lines;
};

const buildAllocations = (
  bankLines: BankLineSeed[],
  rng: RandomGenerator,
): AllocationSeed[] => {
  const allocations: AllocationSeed[] = [];

  bankLines.forEach((line) => {
    const allocationCount = randomInt(1, 3, rng);
    const total = Math.abs(Number(line.amount));
    const weights = Array.from({ length: allocationCount }, () => randomNumber(0.4, 1.25, rng));
    const weightTotal = weights.reduce((acc, value) => acc + value, 0);
    let allocated = 0;

    weights.forEach((weight, index) => {
      const isLast = index === allocationCount - 1;
      const proportional = (total * weight) / weightTotal;
      const amountValue = isLast ? total - allocated : Number(toCurrency(proportional));
      allocated = Number(toCurrency(allocated + amountValue));
      const signedAmount = Number(toCurrency(amountValue)) * Math.sign(Number(line.amount));

      allocations.push({
        id: `${line.id}-alloc-${index + 1}`,
        bankLineId: line.id,
        category: randomPick(CATEGORIES, rng),
        amount: toCurrency(signedAmount),
        notes: rng() > 0.5 ? randomPick(ALLOCATION_NOTES, rng) : undefined,
        createdAt: randomPastDate(10, rng),
      });
    });
  });

  return allocations;
};

const buildAuditEvents = (
  orgId: string,
  policies: PolicySeed[],
  bankLines: BankLineSeed[],
  allocations: AllocationSeed[],
  rng: RandomGenerator,
): AuditEventSeed[] => {
  const events: AuditEventSeed[] = [];

  const relatedAllocations = allocations.slice(0, Math.min(allocations.length, 8));
  const policyEvents = policies.map((policy) => {
    const { actor, actorType } = randomPick(ACTORS, rng);
    return {
      id: `${policy.id}-audit-${slugify(actor)}`,
      orgId,
      actor,
      actorType,
      action: randomPick(AUDIT_ACTIONS, rng),
      entityType: "policy",
      entityId: policy.id,
      metadata: {
        name: policy.name,
        status: policy.status,
      },
      createdAt: randomPastDate(15, rng),
    } satisfies AuditEventSeed;
  });
  events.push(...policyEvents);

  relatedAllocations.forEach((allocation) => {
    const { actor, actorType } = randomPick(ACTORS, rng);
    events.push({
      id: `${allocation.id}-audit`,
      orgId,
      actor,
      actorType,
      action: "ALLOCATION_CREATED",
      entityType: "allocation",
      entityId: allocation.id,
      metadata: {
        bankLineId: allocation.bankLineId,
        category: allocation.category,
        amount: allocation.amount,
      },
      createdAt: randomPastDate(7, rng),
    });
  });

  bankLines.slice(0, 3).forEach((line) => {
    const { actor, actorType } = randomPick(ACTORS, rng);
    events.push({
      id: `${line.id}-audit`,
      orgId,
      actor,
      actorType,
      action: "BANK_LINE_IMPORTED",
      entityType: "bank_line",
      entityId: line.id,
      metadata: {
        payee: line.payee,
        desc: line.desc,
        amount: line.amount,
      },
      createdAt: randomPastDate(3, rng),
    });
  });

  return events;
};

export const generateSeedData = (orgId: string): SeedData => {
  const rng = createSeedRandom(orgId);
  const { policies, gates } = buildPolicies(orgId, rng);
  const bankLines = buildBankLines(orgId, rng);
  const allocations = buildAllocations(bankLines, rng);
  const auditEvents = buildAuditEvents(orgId, policies, bankLines, allocations, rng);

  return {
    policies,
    gates,
    bankLines,
    allocations,
    auditEvents,
  };
};

