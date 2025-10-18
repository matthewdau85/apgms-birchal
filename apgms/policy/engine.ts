export type ReconciliationStatus = "approved" | "rejected" | "manual_review";

export interface PolicyContext {
  readonly [key: string]: unknown;
}

export interface ReconciliationEffect {
  readonly status: ReconciliationStatus;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ReconciliationOutcome extends ReconciliationEffect {
  readonly ruleId: string;
}

export type PolicyCondition = (context: PolicyContext) => boolean;

export type RuleEffectFactory = (
  context: PolicyContext,
) => ReconciliationEffect;

export interface PolicyRule {
  readonly id: string;
  readonly description?: string;
  readonly priority?: number;
  readonly when: PolicyCondition;
  readonly effect: ReconciliationEffect | RuleEffectFactory;
  /**
   * Override to continue evaluating subsequent rules even when the rule matches.
   * Defaults to stopping evaluation after the first match unless collectAllMatches is enabled.
   */
  readonly stopOnMatch?: boolean;
}

export interface PolicyEvaluationOptions {
  /**
   * Outcome that is returned when no rule matches. Defaults to a manual review decision.
   */
  readonly defaultOutcome?: ReconciliationEffect & { readonly ruleId?: string };
  /**
   * When true, evaluates all rules even if matches are found. Useful for auditing.
   */
  readonly collectAllMatches?: boolean;
}

export interface PolicyEvaluationTrace {
  readonly rule: PolicyRule;
  readonly matched: boolean;
  readonly outcome?: ReconciliationOutcome;
  readonly error?: Error;
}

export interface PolicyEvaluationResult {
  readonly outcomes: ReconciliationOutcome[];
  readonly finalOutcome: ReconciliationOutcome;
  readonly matchedRules: string[];
  readonly trace: PolicyEvaluationTrace[];
}

const DEFAULT_OUTCOME: ReconciliationOutcome = {
  ruleId: "policy.default",
  status: "manual_review",
  reason: "no_matching_rule",
};

function normalizeDefaultOutcome(
  fallback?: PolicyEvaluationOptions["defaultOutcome"],
): ReconciliationOutcome {
  if (!fallback) {
    return DEFAULT_OUTCOME;
  }

  const { ruleId, ...rest } = fallback;
  return {
    ruleId: ruleId ?? DEFAULT_OUTCOME.ruleId,
    status: rest.status ?? DEFAULT_OUTCOME.status,
    reason: rest.reason ?? DEFAULT_OUTCOME.reason,
    metadata: rest.metadata,
  };
}

function resolveEffect(
  rule: PolicyRule,
  context: PolicyContext,
): ReconciliationOutcome {
  const rawEffect =
    typeof rule.effect === "function"
      ? (rule.effect as RuleEffectFactory)(context)
      : rule.effect;

  return {
    ruleId: rule.id,
    status: rawEffect.status,
    reason: rawEffect.reason,
    metadata: rawEffect.metadata,
  } satisfies ReconciliationOutcome;
}

function byPriority(left: PolicyRule, right: PolicyRule): number {
  const leftPriority = left.priority ?? Number.POSITIVE_INFINITY;
  const rightPriority = right.priority ?? Number.POSITIVE_INFINITY;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return left.id.localeCompare(right.id);
}

export function evaluatePolicy(
  rules: readonly PolicyRule[],
  context: PolicyContext,
  options: PolicyEvaluationOptions = {},
): PolicyEvaluationResult {
  const sortedRules = [...rules].sort(byPriority);
  const trace: PolicyEvaluationTrace[] = [];
  const outcomes: ReconciliationOutcome[] = [];
  const matchedRules: string[] = [];

  const stopOnFirstMatch = options.collectAllMatches !== true;

  for (const rule of sortedRules) {
    let matched = false;
    try {
      matched = Boolean(rule.when(context));
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error(String(error ?? "unknown_error"));
      trace.push({ rule, matched: false, error: err });
      continue;
    }

    if (!matched) {
      trace.push({ rule, matched: false });
      continue;
    }

    const outcome = resolveEffect(rule, context);
    outcomes.push(outcome);
    matchedRules.push(rule.id);
    trace.push({ rule, matched: true, outcome });

    const shouldStop = stopOnFirstMatch && (rule.stopOnMatch ?? true);
    if (shouldStop) {
      break;
    }
  }

  const finalOutcome =
    outcomes[outcomes.length - 1] ?? normalizeDefaultOutcome(options.defaultOutcome);

  return {
    outcomes,
    finalOutcome,
    matchedRules,
    trace,
  };
}
