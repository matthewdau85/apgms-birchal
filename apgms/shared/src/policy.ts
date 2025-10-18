export type PolicyEffect = "allow" | "deny";

export interface PolicyContext {
  action: string;
  actor: string;
  actorOrgId: string;
  orgId: string;
  amount?: number;
  ledgerBalance?: number;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

export interface PolicyCondition {
  description: string;
  test: (context: PolicyContext) => boolean;
}

export interface PolicyInvariant {
  name: string;
  description: string;
  check: (context: PolicyContext) => boolean;
}

export interface PolicyDefinition {
  action: string;
  effect: PolicyEffect;
  description: string;
  priority?: number;
  conditions?: PolicyCondition[];
  invariants?: PolicyInvariant[];
}

export interface PolicyEvaluation {
  decision: PolicyEffect;
  policy?: PolicyDefinition;
  reasons: string[];
  invariantViolations: string[];
}

const DEFAULT_PRIORITY = 1000;

function sortPolicies(policies: PolicyDefinition[]): PolicyDefinition[] {
  return [...policies].sort((a, b) => {
    const priorityDelta = (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY);
    if (priorityDelta !== 0) return priorityDelta;
    const actionDelta = a.action.localeCompare(b.action);
    if (actionDelta !== 0) return actionDelta;
    const effectDelta = a.effect.localeCompare(b.effect);
    if (effectDelta !== 0) return effectDelta;
    return a.description.localeCompare(b.description);
  });
}

export class PolicyEngine {
  private readonly policies: PolicyDefinition[];
  private readonly defaultEffect: PolicyEffect;

  constructor(policies: PolicyDefinition[], defaultEffect: PolicyEffect = "deny") {
    this.policies = sortPolicies(policies);
    this.defaultEffect = defaultEffect;
  }

  listPolicies(action?: string): PolicyDefinition[] {
    if (!action) return [...this.policies];
    return this.policies.filter((policy) => policy.action === action);
  }

  evaluate(action: string, context: Omit<PolicyContext, "action">): PolicyEvaluation {
    const normalizedContext: PolicyContext = { ...context, action };
    const evaluation: PolicyEvaluation = {
      decision: this.defaultEffect,
      reasons: [],
      invariantViolations: [],
    };

    const applicable = this.policies.filter((policy) => policy.action === action);
    for (const policy of applicable) {
      const conditions = policy.conditions ?? [];
      const passed = conditions.every((condition) => {
        try {
          return condition.test(normalizedContext);
        } catch (error) {
          evaluation.reasons.push(
            `condition_failed:${policy.description}:${condition.description}:${String(error)}`,
          );
          return false;
        }
      });

      if (!passed) {
        evaluation.reasons.push(`skipped:${policy.description}`);
        continue;
      }

      evaluation.decision = policy.effect;
      evaluation.policy = policy;

      if (policy.effect === "allow") {
        const invariants = policy.invariants ?? [];
        for (const invariant of invariants) {
          const ok = invariant.check(normalizedContext);
          if (!ok) {
            evaluation.invariantViolations.push(invariant.description);
            evaluation.decision = "deny";
          }
        }
      }

      if (evaluation.decision !== this.defaultEffect) {
        return evaluation;
      }
    }

    return evaluation;
  }
}

export const defaultPolicies: PolicyDefinition[] = [
  {
    action: "bank-line:list",
    effect: "allow",
    description: "finance-readers-can-list",
    priority: 10,
    conditions: [
      {
        description: "requires-read-role",
        test: (ctx) => (ctx.roles ?? []).some((role) => role.startsWith("finance:read")),
      },
      {
        description: "org-scope",
        test: (ctx) => ctx.actorOrgId === ctx.orgId,
      },
    ],
  },
  {
    action: "bank-line:list",
    effect: "deny",
    description: "default-deny-bank-line-list",
    priority: 1000,
  },
  {
    action: "bank-line:create",
    effect: "allow",
    description: "finance-writers-can-create",
    priority: 10,
    conditions: [
      {
        description: "requires-write-role",
        test: (ctx) => (ctx.roles ?? []).some((role) => role.startsWith("finance:write")),
      },
      {
        description: "org-scope",
        test: (ctx) => ctx.actorOrgId === ctx.orgId,
      },
      {
        description: "non-negative-amount",
        test: (ctx) => (ctx.amount ?? 0) >= 0,
      },
    ],
    invariants: [
      {
        name: "ledger-non-negative",
        description: "ledger balance cannot become negative",
        check: (ctx) => (ctx.ledgerBalance ?? 0) + (ctx.amount ?? 0) >= 0,
      },
      {
        name: "bounded-amount",
        description: "transactions must be within a bounded range",
        check: (ctx) => Math.abs(ctx.amount ?? 0) <= 1_000_000,
      },
    ],
  },
  {
    action: "bank-line:create",
    effect: "deny",
    description: "default-deny-bank-line-create",
    priority: 1000,
  },
];
