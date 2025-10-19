import { createHash } from 'node:crypto';

type GateState = 'OPEN' | 'CLOSED';

export interface BankLine {
  availableCents: bigint;
  gate?: GateState;
}

export interface Corridor {
  /** Basis points (0-10000) */
  minBps: number;
  /** Basis points (0-10000) */
  maxBps: number;
}

export interface PolicyBucketRule {
  bucketId: string;
  corridor: Corridor;
  counterpartyAllow?: string[];
  counterpartyDeny?: string[];
  gate?: GateState;
}

export interface PolicyRuleset {
  buckets: PolicyBucketRule[];
}

export interface AccountState {
  accountId: string;
  bucketId: string;
  requestedCents: bigint;
  counterpartyId: string;
  gate?: GateState;
}

export interface Allocation {
  accountId: string;
  bucketId: string;
  allocatedCents: bigint;
}

export interface ApplyPolicyInput {
  bankLine: BankLine;
  ruleset: PolicyRuleset;
  accountStates: AccountState[];
}

export interface ApplyPolicyOutput {
  allocations: Allocation[];
  policyHash: string;
  explain: string;
}

interface BucketComputation {
  rule: PolicyBucketRule;
  requested: bigint;
  minBound: bigint;
  maxBound: bigint;
  minRequired: bigint;
  accounts: AccountState[];
  allocation: bigint;
}

const BASIS_POINT_SCALE = 10_000n;

export function bankersRound(dividend: bigint, divisor: bigint): bigint {
  if (divisor === 0n) {
    throw new Error('Division by zero in bankersRound');
  }
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  const doubled = remainder * 2n;
  if (doubled < divisor) {
    return quotient;
  }
  if (doubled > divisor) {
    return quotient + 1n;
  }
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

function canonicalRuleset(ruleset: PolicyRuleset): string {
  const canonicalBuckets = [...ruleset.buckets]
    .map((bucket) => ({
      bucketId: bucket.bucketId,
      corridor: {
        minBps: bucket.corridor.minBps,
        maxBps: bucket.corridor.maxBps,
      },
      allow: bucket.counterpartyAllow ? [...bucket.counterpartyAllow].sort() : [],
      deny: bucket.counterpartyDeny ? [...bucket.counterpartyDeny].sort() : [],
      gate: bucket.gate ?? 'OPEN',
    }))
    .sort((a, b) => a.bucketId.localeCompare(b.bucketId));
  return JSON.stringify({ buckets: canonicalBuckets });
}

function withinAllowList(allow: string[] | undefined, counterpartyId: string): boolean {
  if (!allow || allow.length === 0) {
    return true;
  }
  return allow.includes(counterpartyId);
}

function withinDenyList(deny: string[] | undefined, counterpartyId: string): boolean {
  if (!deny || deny.length === 0) {
    return true;
  }
  return !deny.includes(counterpartyId);
}

function computeBounds(total: bigint, rule: PolicyBucketRule): { min: bigint; max: bigint } {
  const min = bankersRound(total * BigInt(rule.corridor.minBps), BASIS_POINT_SCALE);
  const max = bankersRound(total * BigInt(rule.corridor.maxBps), BASIS_POINT_SCALE);
  return {
    min: min < 0n ? 0n : min,
    max: max < 0n ? 0n : max,
  };
}

function filterEligibleAccounts(
  accounts: AccountState[],
  rule: PolicyBucketRule,
  bankLineGate: GateState,
): AccountState[] {
  if (bankLineGate === 'CLOSED' || (rule.gate ?? 'OPEN') === 'CLOSED') {
    return [];
  }
  return accounts.filter((account) => {
    if ((account.gate ?? 'OPEN') === 'CLOSED') {
      return false;
    }
    if (!withinAllowList(rule.counterpartyAllow, account.counterpartyId)) {
      return false;
    }
    if (!withinDenyList(rule.counterpartyDeny, account.counterpartyId)) {
      return false;
    }
    return true;
  });
}

function distributeToAccounts(
  bucket: BucketComputation,
  existingAllocations: Map<string, Allocation>,
): void {
  const { accounts, allocation, requested } = bucket;
  if (accounts.length === 0 || allocation === 0n) {
    return;
  }
  const sortedAccounts = [...accounts].sort((a, b) => a.accountId.localeCompare(b.accountId));
  const totalRequested = requested === 0n ? 1n : requested;
  let remaining = allocation;
  for (let index = 0; index < sortedAccounts.length; index += 1) {
    const account = sortedAccounts[index];
    const isLast = index === sortedAccounts.length - 1;
    let share: bigint;
    if (isLast) {
      share = remaining;
    } else {
      const rawShare = allocation * account.requestedCents;
      const rounded = bankersRound(rawShare, totalRequested);
      share = rounded;
    }
    if (share > account.requestedCents) {
      share = account.requestedCents;
    }
    if (share > remaining) {
      share = remaining;
    }
    remaining -= share;
    const prior = existingAllocations.get(account.accountId);
    if (!prior) {
      existingAllocations.set(account.accountId, {
        accountId: account.accountId,
        bucketId: account.bucketId,
        allocatedCents: share,
      });
    } else {
      prior.allocatedCents += share;
    }
  }
}

function ensureAllocationMap(
  map: Map<string, Allocation>,
  accounts: AccountState[],
): void {
  for (const account of accounts) {
    if (!map.has(account.accountId)) {
      map.set(account.accountId, {
        accountId: account.accountId,
        bucketId: account.bucketId,
        allocatedCents: 0n,
      });
    }
  }
}

export function applyPolicy({ bankLine, ruleset, accountStates }: ApplyPolicyInput): ApplyPolicyOutput {
  const available = bankLine.availableCents < 0n ? 0n : bankLine.availableCents;
  const bankLineGate = bankLine.gate ?? 'OPEN';
  const policyHash = createHash('sha256').update(canonicalRuleset(ruleset)).digest('hex');
  const allocationsMap = new Map<string, Allocation>();
  ensureAllocationMap(allocationsMap, accountStates);

  if (available === 0n || bankLineGate === 'CLOSED') {
    return {
      allocations: [...allocationsMap.values()],
      policyHash,
      explain: bankLineGate === 'CLOSED' ? 'gate:CLOSED;total:0' : 'gate:OPEN;total:0',
    };
  }

  const bucketOrder = [...ruleset.buckets]
    .map((rule) => rule.bucketId)
    .sort((a, b) => a.localeCompare(b));

  const ruleByBucket = new Map<string, PolicyBucketRule>();
  for (const bucketRule of ruleset.buckets) {
    ruleByBucket.set(bucketRule.bucketId, bucketRule);
  }

  const accountsByBucket = new Map<string, AccountState[]>();
  for (const account of accountStates) {
    const list = accountsByBucket.get(account.bucketId) ?? [];
    list.push(account);
    accountsByBucket.set(account.bucketId, list);
  }

  const bucketComputations: BucketComputation[] = bucketOrder.map((bucketId) => {
    const rule = ruleByBucket.get(bucketId);
    if (!rule) {
      throw new Error(`Missing rule for bucket ${bucketId}`);
    }
    const relevantAccounts = accountsByBucket.get(bucketId) ?? [];
    const eligibleAccounts = filterEligibleAccounts(relevantAccounts, rule, bankLineGate);
    const requested = eligibleAccounts.reduce<bigint>((sum, account) => {
      const value = account.requestedCents < 0n ? 0n : account.requestedCents;
      return sum + value;
    }, 0n);
    const { min: minBound, max: maxBound } = computeBounds(available, rule);
    const cappedRequested = requested > maxBound ? maxBound : requested;
    const minRequired = requested >= minBound ? (minBound < requested ? minBound : requested) : requested;
    return {
      rule,
      accounts: eligibleAccounts,
      requested,
      minBound,
      maxBound,
      minRequired,
      allocation: cappedRequested,
    };
  });

  let totalAllocated = bucketComputations.reduce((sum, bucket) => sum + bucket.allocation, 0n);
  if (totalAllocated > available) {
    let excess = totalAllocated - available;
    for (const bucket of bucketComputations) {
      if (excess === 0n) {
        break;
      }
      const reducible = bucket.allocation - bucket.minRequired;
      if (reducible <= 0n) {
        continue;
      }
      const delta = reducible >= excess ? excess : reducible;
      bucket.allocation -= delta;
      excess -= delta;
    }
    if (excess > 0n) {
      for (const bucket of bucketComputations) {
        if (excess === 0n) {
          break;
        }
        const reducible = bucket.allocation;
        if (reducible <= 0n) {
          continue;
        }
        const delta = reducible >= excess ? excess : reducible;
        bucket.allocation -= delta;
        excess -= delta;
      }
    }
    totalAllocated = bucketComputations.reduce((sum, bucket) => sum + bucket.allocation, 0n);
  }

  let leftover = available - totalAllocated;
  if (leftover > 0n) {
    for (const bucket of bucketComputations) {
      if (leftover === 0n) {
        break;
      }
      if (bucket.minRequired > bucket.allocation) {
        const desired = bucket.minRequired - bucket.allocation;
        const possible = bucket.requested - bucket.allocation;
        const increment = desired < possible ? desired : possible;
        if (increment > 0n) {
          const delta = increment >= leftover ? leftover : increment;
          bucket.allocation += delta;
          leftover -= delta;
        }
      }
    }
    if (leftover > 0n) {
      for (const bucket of bucketComputations) {
        if (leftover === 0n) {
          break;
        }
        const capacityByMax = bucket.maxBound - bucket.allocation;
        const capacityByRequest = bucket.requested - bucket.allocation;
        const capacity = capacityByMax < capacityByRequest ? capacityByMax : capacityByRequest;
        if (capacity <= 0n) {
          continue;
        }
        const delta = capacity >= leftover ? leftover : capacity;
        bucket.allocation += delta;
        leftover -= delta;
      }
    }
  }

  for (const bucket of bucketComputations) {
    distributeToAccounts(bucket, allocationsMap);
  }

  const explainParts = bucketComputations.map((bucket) => {
    const allocated = bucket.allocation;
    return `${bucket.rule.bucketId}:${allocated.toString()}/${bucket.requested.toString()}`;
  });
  const explain = `gate:${bankLineGate};buckets:${explainParts.join(',')};leftover:${leftover.toString()}`;

  return {
    allocations: [...allocationsMap.values()].sort((a, b) => a.accountId.localeCompare(b.accountId)),
    policyHash,
    explain,
  };
}
