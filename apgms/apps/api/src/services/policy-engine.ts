import { createHash } from "node:crypto";

export interface BankLineInput {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  metadata?: Record<string, unknown>;
}

export interface TextCondition {
  kind: "text";
  field: "payee" | "desc";
  operator: "contains" | "startsWith" | "endsWith" | "equals";
  value: string;
  caseSensitive?: boolean;
}

export interface AmountCondition {
  kind: "amount";
  operator: "gte" | "lte" | "eq";
  value: number;
}

export interface MetadataCondition {
  kind: "metadata";
  key: string;
  operator: "equals" | "notEquals";
  value: string | number | boolean | null;
}

export type AllocationCondition = TextCondition | AmountCondition | MetadataCondition;

export interface AllocationTarget {
  accountId: string;
  ratio?: number;
  amount?: number;
  memo?: string;
}

export interface AllocationBreakdown {
  accountId: string;
  amount: number;
  ratio?: number;
  memo?: string;
}

export interface AllocationRule {
  id: string;
  name: string;
  conditions: AllocationCondition[];
  allocation: AllocationTarget[];
  minMatchCount?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface AllocationRuleSet {
  id: string;
  name: string;
  version?: string;
  rules: AllocationRule[];
  metadata?: Record<string, unknown>;
}

export interface AllocationProposal {
  ruleId: string;
  ruleName: string;
  policyHash: string;
  allocation: AllocationBreakdown[];
  totalAmount: number;
  confidence: number;
  metadata?: Record<string, unknown>;
  matchedConditions: AllocationCondition[];
}

export interface PolicyEvaluation {
  bankLineId: string;
  ruleSetId: string;
  ruleSetVersion?: string;
  proposals: AllocationProposal[];
  evaluatedAt: string;
}

export interface EvaluateOptions {
  minimumConfidence?: number;
}

export const DEFAULT_RULE_VERSION = "2024.09";

const BASE_RULES: AllocationRule[] = [
  {
    id: "tax-ato",
    name: "ATO liability allocation",
    conditions: [
      { kind: "text", field: "payee", operator: "contains", value: "ATO", caseSensitive: false },
    ],
    allocation: [
      { accountId: "TAX_PAYABLE", ratio: 1, memo: "ATO remittance" },
    ],
    metadata: { category: "tax" },
    priority: 100,
  },
  {
    id: "payroll-salaries",
    name: "Payroll wages",
    conditions: [
      { kind: "text", field: "desc", operator: "contains", value: "salary", caseSensitive: false },
      { kind: "amount", operator: "lte", value: -100 },
    ],
    allocation: [
      { accountId: "WAGES_PAYABLE", ratio: 0.9, memo: "Net wages" },
      { accountId: "PAYROLL_TAX", ratio: 0.1, memo: "Payroll tax" },
    ],
    metadata: { category: "payroll" },
    priority: 90,
  },
  {
    id: "subscriptions",
    name: "Software subscriptions",
    conditions: [
      { kind: "text", field: "desc", operator: "contains", value: "subscription", caseSensitive: false },
    ],
    allocation: [
      { accountId: "SOFTWARE_EXPENSE", ratio: 1, memo: "Subscription" },
    ],
    metadata: { category: "software" },
    priority: 70,
  },
  {
    id: "merchant-fees",
    name: "Merchant fees",
    conditions: [
      { kind: "text", field: "desc", operator: "contains", value: "stripe", caseSensitive: false },
    ],
    allocation: [
      { accountId: "MERCHANT_FEES", ratio: 0.6 },
      { accountId: "PLATFORM_COSTS", ratio: 0.4 },
    ],
    metadata: { category: "payments" },
    priority: 60,
  },
  {
    id: "general-expense",
    name: "General operating expense",
    conditions: [
      { kind: "amount", operator: "lte", value: 0 },
    ],
    allocation: [
      { accountId: "OPERATING_EXPENSES", ratio: 1 },
    ],
    metadata: { category: "general" },
    priority: 10,
  },
];

export function resolveRuleSetForOrg(orgId: string): AllocationRuleSet {
  const clonedRules = BASE_RULES.map((rule) => ({
    ...rule,
    allocation: rule.allocation.map((target) => ({ ...target })),
    conditions: rule.conditions.map((condition) => ({ ...condition })),
  }));

  return {
    id: `default-${orgId}`,
    name: "Default allocation policy",
    version: DEFAULT_RULE_VERSION,
    rules: clonedRules,
    metadata: { orgId, template: "default" },
  };
}

export function evaluateRuleSet(
  bankLine: BankLineInput,
  ruleSet: AllocationRuleSet,
  options: EvaluateOptions = {},
): PolicyEvaluation {
  const proposals: AllocationProposal[] = [];
  const minimumConfidence = options.minimumConfidence ?? 0;

  for (const rule of [...ruleSet.rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
    const evaluation = evaluateRule(bankLine, ruleSet, rule);
    if (!evaluation) {
      continue;
    }

    if (evaluation.confidence < minimumConfidence) {
      continue;
    }

    proposals.push(evaluation);
  }

  return {
    bankLineId: bankLine.id,
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    proposals,
    evaluatedAt: new Date().toISOString(),
  };
}

function evaluateRule(
  bankLine: BankLineInput,
  ruleSet: AllocationRuleSet,
  rule: AllocationRule,
): AllocationProposal | null {
  if (rule.conditions.length === 0) {
    return buildProposal(bankLine, ruleSet, rule, rule.allocation, 1, []);
  }

  const matchedConditions = rule.conditions.filter((condition) => matchesCondition(bankLine, condition));
  const minMatchCount = rule.minMatchCount ?? rule.conditions.length;
  if (matchedConditions.length < minMatchCount) {
    return null;
  }

  const confidence = matchedConditions.length / rule.conditions.length;
  return buildProposal(bankLine, ruleSet, rule, rule.allocation, confidence, matchedConditions);
}

function buildProposal(
  bankLine: BankLineInput,
  ruleSet: AllocationRuleSet,
  rule: AllocationRule,
  allocation: AllocationTarget[],
  confidence: number,
  matchedConditions: AllocationCondition[],
): AllocationProposal {
  const breakdown = allocation.map((target) => deriveAllocation(bankLine.amount, target));
  const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const policyHash = computePolicyHash(ruleSet, rule, breakdown);

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    policyHash,
    allocation: breakdown,
    totalAmount,
    confidence,
    metadata: rule.metadata,
    matchedConditions,
  };
}

function deriveAllocation(amount: number, target: AllocationTarget): AllocationBreakdown {
  const ratio = typeof target.ratio === "number" ? target.ratio : undefined;
  const explicitAmount = typeof target.amount === "number" ? target.amount : undefined;
  const computedAmount = explicitAmount ?? roundToCents(amount * (ratio ?? 0));

  return {
    accountId: target.accountId,
    amount: roundToCents(computedAmount),
    ratio,
    memo: target.memo,
  };
}

function matchesCondition(bankLine: BankLineInput, condition: AllocationCondition): boolean {
  switch (condition.kind) {
    case "text": {
      const source = condition.field === "payee" ? bankLine.payee : bankLine.desc;
      const comparator = condition.caseSensitive ? source : source.toLowerCase();
      const value = condition.caseSensitive ? condition.value : condition.value.toLowerCase();

      switch (condition.operator) {
        case "contains":
          return comparator.includes(value);
        case "startsWith":
          return comparator.startsWith(value);
        case "endsWith":
          return comparator.endsWith(value);
        case "equals":
          return comparator === value;
        default:
          return false;
      }
    }
    case "amount": {
      switch (condition.operator) {
        case "gte":
          return bankLine.amount >= condition.value;
        case "lte":
          return bankLine.amount <= condition.value;
        case "eq":
          return Math.abs(bankLine.amount - condition.value) < 0.000001;
        default:
          return false;
      }
    }
    case "metadata": {
      const value = bankLine.metadata?.[condition.key];
      if (condition.operator === "equals") {
        return value === condition.value;
      }
      if (condition.operator === "notEquals") {
        return value !== condition.value;
      }
      return false;
    }
    default:
      return false;
  }
}

export function computePolicyHash(
  ruleSet: AllocationRuleSet,
  rule: AllocationRule,
  allocation: AllocationBreakdown[],
): string {
  const hash = createHash("sha256");
  hash.update(ruleSet.id);
  if (ruleSet.version) {
    hash.update(ruleSet.version);
  }
  hash.update(rule.id);
  hash.update(JSON.stringify(rule.conditions.map(serializeCondition)));
  hash.update(JSON.stringify(canonicalizeAllocation(allocation)));
  return hash.digest("hex");
}

export function canonicalizeAllocation(allocation: AllocationBreakdown[]): AllocationBreakdown[] {
  return [...allocation]
    .map((entry) => ({
      accountId: entry.accountId,
      amount: roundToCents(entry.amount),
      ratio: typeof entry.ratio === "number" ? Number(entry.ratio.toFixed(6)) : undefined,
      memo: entry.memo,
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}

export function allocationsEqual(a: AllocationBreakdown[], b: AllocationBreakdown[]): boolean {
  const canonicalA = canonicalizeAllocation(a);
  const canonicalB = canonicalizeAllocation(b);
  if (canonicalA.length !== canonicalB.length) {
    return false;
  }

  return canonicalA.every((entry, index) => {
    const other = canonicalB[index];
    return (
      entry.accountId === other.accountId &&
      Math.abs(entry.amount - other.amount) < 0.01 &&
      (entry.memo ?? null) === (other.memo ?? null)
    );
  });
}

function serializeCondition(condition: AllocationCondition): unknown {
  switch (condition.kind) {
    case "text":
      return {
        ...condition,
        value: condition.caseSensitive ? condition.value : condition.value.toLowerCase(),
      };
    default:
      return condition;
  }
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normaliseAmount(amount: unknown): number {
  if (typeof amount === "number") {
    return amount;
  }
  if (typeof amount === "string") {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (amount && typeof amount === "object" && typeof (amount as { toString?: () => string }).toString === "function") {
    const raw = (amount as { toString: () => string }).toString();
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  throw new TypeError(`Unsupported amount type: ${amount}`);
}

export function asBankLineInput(value: {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string;
  desc: string;
  metadata?: Record<string, unknown>;
}): BankLineInput {
  return {
    id: value.id,
    orgId: value.orgId,
    date: value.date,
    amount: normaliseAmount(value.amount),
    payee: value.payee,
    desc: value.desc,
    metadata: value.metadata,
  };
}
