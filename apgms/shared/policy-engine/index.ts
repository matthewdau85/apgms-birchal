export type GateState = 'OPEN' | 'CLOSED';

export interface AccountState {
  accountId: string;
  gate?: GateState;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyRule {
  accountId: string;
  gate?: GateState;
  weight?: number;
}

export interface ApplyPolicyInput {
  bankLine: number;
  ruleset?: PolicyRule[];
  accountStates: AccountState[];
}

export interface Allocation {
  accountId: string;
  amount: number;
  gate: GateState;
}

export interface ApplyPolicyResult {
  allocations: Allocation[];
  policyHash: string;
  explain: string;
}

const DEFAULT_GATE: GateState = 'OPEN';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);

  return `{${entries.join(',')}}`;
}

function hash(value: unknown): string {
  const text = stableStringify(value);
  let acc = 0;

  for (let index = 0; index < text.length; index += 1) {
    acc = (acc * 31 + text.charCodeAt(index)) >>> 0;
  }

  return acc.toString(16).padStart(8, '0');
}

function sanitiseBankLine(bankLine: number): number {
  if (!Number.isFinite(bankLine) || bankLine <= 0) {
    return 0;
  }

  return bankLine;
}

function normaliseRuleMap(ruleset: PolicyRule[] | undefined): Map<string, PolicyRule> {
  const map = new Map<string, PolicyRule>();

  if (!Array.isArray(ruleset)) {
    return map;
  }

  for (const rule of ruleset) {
    if (rule && typeof rule.accountId === 'string') {
      map.set(rule.accountId, rule);
    }
  }

  return map;
}

function determineGate(account: AccountState, rule?: PolicyRule): GateState {
  const gate = rule?.gate ?? account.gate ?? DEFAULT_GATE;
  return gate === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

function determineWeight(account: AccountState, rule?: PolicyRule): number {
  const raw = rule?.weight ?? account.weight ?? 1;

  if (!Number.isFinite(raw) || raw < 0) {
    return 0;
  }

  return raw;
}

export function applyPolicy({ bankLine, ruleset, accountStates }: ApplyPolicyInput): ApplyPolicyResult {
  const safeBankLine = sanitiseBankLine(bankLine);
  const ruleMap = normaliseRuleMap(ruleset);

  const normalisedAccounts = accountStates.map((account) => {
    const rule = account.accountId ? ruleMap.get(account.accountId) : undefined;
    const gate = determineGate(account, rule);
    const weight = determineWeight(account, rule);

    return { accountId: account.accountId, gate, weight };
  });

  const openAccounts = normalisedAccounts.filter((account) => account.gate !== 'CLOSED');

  const allocations: Allocation[] = normalisedAccounts.map((account) => ({
    accountId: account.accountId,
    amount: 0,
    gate: account.gate,
  }));

  if (safeBankLine === 0 || openAccounts.length === 0) {
    return {
      allocations,
      policyHash: hash({ bankLine: safeBankLine, normalisedAccounts }),
      explain: 'No distributable bank line or all gates closed.',
    };
  }

  let totalWeight = openAccounts.reduce((sum, account) => sum + account.weight, 0);

  if (totalWeight <= 0) {
    totalWeight = openAccounts.length;
    openAccounts.forEach((account) => {
      account.weight = 1;
    });
  }

  let allocatedSoFar = 0;

  openAccounts.forEach((account, index) => {
    const allocation = allocations.find((item) => item.accountId === account.accountId);
    if (!allocation) {
      return;
    }

    const isLast = index === openAccounts.length - 1;
    const rawAmount = isLast
      ? safeBankLine - allocatedSoFar
      : (safeBankLine * account.weight) / totalWeight;

    const amount = Math.max(0, rawAmount);
    allocation.amount = amount;
    allocation.gate = account.gate;
    allocatedSoFar += amount;
  });

  const totalAllocated = allocations.reduce((sum, current) => sum + current.amount, 0);
  const discrepancy = safeBankLine - totalAllocated;

  if (Math.abs(discrepancy) > Number.EPSILON) {
    const adjustable = allocations.find((allocation) => allocation.gate !== 'CLOSED');
    if (adjustable) {
      adjustable.amount = Math.max(0, adjustable.amount + discrepancy);
      allocatedSoFar = allocations.reduce((sum, current) => sum + current.amount, 0);
    }
  }

  return {
    allocations,
    policyHash: hash({ bankLine: safeBankLine, allocations }),
    explain: `Allocated ${allocatedSoFar.toFixed(2)} across ${openAccounts.length} open accounts from a bank line of ${safeBankLine.toFixed(2)}.`,
  };
}
