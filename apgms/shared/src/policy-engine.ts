import { randomUUID } from "node:crypto";

export interface ContributionInput {
  id?: string;
  amount: number;
  riskScore?: number;
  metadata?: Record<string, unknown>;
}

export interface Contribution {
  id: string;
  amount: number;
  riskScore: number;
  metadata?: Record<string, unknown>;
}

export type GateRule =
  | { type: "maxAverageRisk"; threshold: number }
  | { type: "maxSingleRisk"; threshold: number }
  | { type: "minTotal"; threshold: number }
  | { type: "maxTotal"; threshold: number };

export interface PolicyDefinition {
  id: string;
  weight: number;
  cap?: number;
  floor?: number;
  gate?: GateRule;
}

export interface ResolvedPolicy {
  id: string;
  weight: number;
  cap: number;
  floor: number;
  gate?: GateRule;
}

export interface Allocation {
  policyId: string;
  amount: number;
  share: number;
}

export interface RequestToPay extends Allocation {
  requestId: string;
}

export interface GateDecision extends RequestToPay {
  approved: boolean;
  reason?: string;
}

export interface GateContext {
  totalAmount: number;
  averageRisk: number;
  maxRisk: number;
  unallocated: number;
}

export interface GateResult {
  approved: GateDecision[];
  rejected: GateDecision[];
  rejectedTotal: number;
  context: GateContext;
}

export interface RemittanceInstruction {
  policyId: string;
  requestId: string;
  amount: number;
  status: "ready";
}

export interface EngineTotals {
  input: number;
  allocated: number;
  remitted: number;
  unallocated: number;
  rejected: number;
  leftover: number;
}

export interface AuditReport {
  ok: boolean;
  issues: string[];
  totals: EngineTotals;
}

export interface EngineRunResult {
  contributions: Contribution[];
  allocations: Allocation[];
  requests: RequestToPay[];
  gate: GateResult;
  remittances: RemittanceInstruction[];
  totals: EngineTotals;
  audit: AuditReport;
}

interface NormalizedPolicy extends ResolvedPolicy {
  cap: number;
}

const DEFAULT_PRECISION = 1e-6;

function ensureFinite(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    throw new Error("Policy values must be finite numbers");
  }
  return value;
}

function clampRisk(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export class PolicyEngine {
  private readonly policies: NormalizedPolicy[];
  private readonly policyIndex: Map<string, NormalizedPolicy>;
  private readonly precision: number;

  constructor(definitions: PolicyDefinition[], options: { precision?: number } = {}) {
    if (!definitions.length) {
      throw new Error("PolicyEngine requires at least one policy definition");
    }
    this.precision = options.precision ?? DEFAULT_PRECISION;

    const seen = new Set<string>();
    this.policies = definitions.map((definition) => {
      if (!definition.id) {
        throw new Error("Policy id is required");
      }
      if (seen.has(definition.id)) {
        throw new Error(`Duplicate policy id: ${definition.id}`);
      }
      seen.add(definition.id);

      const weight = ensureFinite(definition.weight, 0);
      if (weight <= 0) {
        throw new Error(`Policy weight must be positive for ${definition.id}`);
      }

      const rawCap = definition.cap === undefined ? Number.POSITIVE_INFINITY : ensureFinite(definition.cap, 0);
      const cap = rawCap === Number.POSITIVE_INFINITY ? rawCap : Math.max(0, rawCap);
      const floor = Math.max(0, ensureFinite(definition.floor, 0));
      if (cap !== Number.POSITIVE_INFINITY && floor - cap > this.precision) {
        throw new Error(`Policy floor cannot exceed cap for ${definition.id}`);
      }

      return {
        id: definition.id,
        weight,
        cap,
        floor,
        gate: definition.gate,
      } satisfies NormalizedPolicy;
    });

    if (!this.policies.some((policy) => policy.cap > this.precision)) {
      throw new Error("At least one policy must have capacity to receive allocations");
    }

    this.policyIndex = new Map(this.policies.map((policy) => [policy.id, policy]));
  }

  get resolvedPolicies(): ResolvedPolicy[] {
    return this.policies.map((policy) => ({ ...policy }));
  }

  get tolerance(): number {
    return this.precision;
  }

  ingest(inputs: ContributionInput[]): Contribution[] {
    const contributions: Contribution[] = [];
    for (const input of inputs) {
      const numericAmount = Number(input.amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= this.precision) {
        continue;
      }
      const id = input.id ?? randomUUID();
      contributions.push({
        id,
        amount: this.roundAmount(numericAmount),
        riskScore: clampRisk(input.riskScore),
        metadata: input.metadata,
      });
    }
    return contributions;
  }

  allocate(contributions: Contribution[]): { allocations: Allocation[]; leftover: number } {
    const total = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
    if (total <= this.precision) {
      return { allocations: [], leftover: 0 };
    }

    const states = this.policies.map((policy) => ({
      policy,
      amount: 0,
      active: policy.cap > this.precision,
      saturated: policy.cap <= this.precision,
    }));

    let remaining = total;

    while (remaining > this.precision) {
      const activeStates = states.filter((state) => state.active && !state.saturated);
      if (!activeStates.length) {
        break;
      }
      const weightTotal = activeStates.reduce((sum, state) => sum + state.policy.weight, 0);
      if (weightTotal <= this.precision) {
        break;
      }

      let distributedThisRound = 0;
      for (const state of activeStates) {
        const share = (remaining * state.policy.weight) / weightTotal;
        const available = state.policy.cap === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : state.policy.cap - state.amount;
        const assignable = available === Number.POSITIVE_INFINITY ? share : Math.min(available, share);
        if (assignable > this.precision) {
          state.amount += assignable;
          remaining -= assignable;
          distributedThisRound += assignable;
          if (state.policy.cap !== Number.POSITIVE_INFINITY && state.policy.cap - state.amount <= this.precision) {
            state.saturated = true;
          }
        } else {
          state.saturated = true;
        }
      }

      if (distributedThisRound <= this.precision) {
        break;
      }

      let floorsAdjusted = false;
      for (const state of states) {
        if (!state.active) {
          continue;
        }
        const { floor } = state.policy;
        if (floor > this.precision && state.amount > this.precision && state.amount + this.precision < floor) {
          remaining += state.amount;
          state.amount = 0;
          state.active = false;
          state.saturated = true;
          floorsAdjusted = true;
        }
      }

      if (floorsAdjusted) {
        continue;
      }
    }

    const allocations: Allocation[] = [];
    for (const state of states) {
      if (state.amount <= this.precision) {
        continue;
      }
      allocations.push({
        policyId: state.policy.id,
        amount: this.roundAmount(state.amount),
        share: this.roundAmount(state.amount / total),
      });
    }

    return { allocations, leftover: this.roundAmount(Math.max(0, remaining)) };
  }

  createRequests(allocations: Allocation[]): RequestToPay[] {
    return allocations.map((allocation) => ({
      ...allocation,
      requestId: randomUUID(),
    }));
  }

  gate(requests: RequestToPay[], contributions: Contribution[], unallocated = 0): GateResult {
    const totalAmount = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
    const averageRisk = contributions.length
      ? contributions.reduce((sum, contribution) => sum + contribution.riskScore, 0) / contributions.length
      : 0;
    const maxRisk = contributions.reduce((acc, contribution) => Math.max(acc, contribution.riskScore), 0);

    const context: GateContext = {
      totalAmount: this.roundAmount(totalAmount),
      averageRisk: this.roundAmount(averageRisk),
      maxRisk: this.roundAmount(maxRisk),
      unallocated: this.roundAmount(unallocated),
    };

    const approved: GateDecision[] = [];
    const rejected: GateDecision[] = [];
    let rejectedTotal = 0;

    for (const request of requests) {
      const policy = this.policyIndex.get(request.policyId);
      if (!policy) {
        throw new Error(`Unknown policy id: ${request.policyId}`);
      }
      const { approved: isApproved, reason } = this.evaluateGate(policy, context);
      const decision: GateDecision = { ...request, approved: isApproved, reason };
      if (isApproved) {
        approved.push(decision);
      } else {
        rejected.push(decision);
        rejectedTotal += decision.amount;
      }
    }

    return {
      approved,
      rejected,
      rejectedTotal: this.roundAmount(rejectedTotal),
      context,
    };
  }

  remit(decisions: GateDecision[]): RemittanceInstruction[] {
    return decisions.map((decision) => ({
      policyId: decision.policyId,
      requestId: decision.requestId,
      amount: this.roundAmount(decision.amount),
      status: "ready",
    }));
  }

  audit(params: {
    contributions: Contribution[];
    allocations: Allocation[];
    remittances: RemittanceInstruction[];
    unallocated: number;
    gate: GateResult;
  }): AuditReport {
    const totalInput = params.contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
    const allocated = params.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    const remitted = params.remittances.reduce((sum, remittance) => sum + remittance.amount, 0);
    const unallocated = params.unallocated;
    const rejected = params.gate.rejectedTotal;
    const leftover = this.roundAmount(unallocated + rejected);

    const issues: string[] = [];
    if (allocated - totalInput > this.precision) {
      issues.push("Allocated amount exceeds input contributions");
    }

    if (Math.abs(totalInput - (remitted + leftover)) > this.precision * Math.max(1, totalInput)) {
      issues.push("Funds are not balanced across remittance and leftover");
    }

    for (const remittance of params.remittances) {
      const policy = this.policyIndex.get(remittance.policyId);
      if (!policy) {
        issues.push(`Remittance references unknown policy ${remittance.policyId}`);
        continue;
      }
      if (remittance.amount < -this.precision) {
        issues.push(`Negative remittance detected for ${policy.id}`);
      }
      if (policy.cap !== Number.POSITIVE_INFINITY && remittance.amount - policy.cap > this.precision) {
        issues.push(`Remittance exceeds policy cap for ${policy.id}`);
      }
      if (policy.floor > this.precision && remittance.amount > this.precision && policy.floor - remittance.amount > this.precision) {
        issues.push(`Remittance violates policy floor for ${policy.id}`);
      }
    }

    return {
      ok: issues.length === 0,
      issues,
      totals: {
        input: this.roundAmount(totalInput),
        allocated: this.roundAmount(allocated),
        remitted: this.roundAmount(remitted),
        unallocated: this.roundAmount(unallocated),
        rejected: this.roundAmount(rejected),
        leftover,
      },
    };
  }

  run(inputs: ContributionInput[]): EngineRunResult {
    const contributions = this.ingest(inputs);
    const { allocations, leftover } = this.allocate(contributions);
    const requests = this.createRequests(allocations);
    const gate = this.gate(requests, contributions, leftover);
    const remittances = this.remit(gate.approved);

    const totals: EngineTotals = {
      input: this.roundAmount(contributions.reduce((sum, contribution) => sum + contribution.amount, 0)),
      allocated: this.roundAmount(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)),
      remitted: this.roundAmount(remittances.reduce((sum, remittance) => sum + remittance.amount, 0)),
      unallocated: this.roundAmount(leftover),
      rejected: this.roundAmount(gate.rejectedTotal),
      leftover: this.roundAmount(leftover + gate.rejectedTotal),
    };

    const audit = this.audit({ contributions, allocations, remittances, unallocated: leftover, gate });

    return { contributions, allocations, requests, gate, remittances, totals, audit };
  }

  private evaluateGate(policy: NormalizedPolicy, context: GateContext): { approved: boolean; reason?: string } {
    if (!policy.gate) {
      return { approved: true };
    }

    switch (policy.gate.type) {
      case "maxAverageRisk":
        if (context.averageRisk - this.precision <= policy.gate.threshold) {
          return { approved: true };
        }
        return {
          approved: false,
          reason: `Average risk ${context.averageRisk.toFixed(3)} exceeds ${policy.gate.threshold.toFixed(3)}`,
        };
      case "maxSingleRisk":
        if (context.maxRisk - this.precision <= policy.gate.threshold) {
          return { approved: true };
        }
        return {
          approved: false,
          reason: `Max risk ${context.maxRisk.toFixed(3)} exceeds ${policy.gate.threshold.toFixed(3)}`,
        };
      case "minTotal":
        if (context.totalAmount + this.precision >= policy.gate.threshold) {
          return { approved: true };
        }
        return {
          approved: false,
          reason: `Total amount ${context.totalAmount.toFixed(2)} below ${policy.gate.threshold.toFixed(2)}`,
        };
      case "maxTotal":
        if (context.totalAmount - this.precision <= policy.gate.threshold) {
          return { approved: true };
        }
        return {
          approved: false,
          reason: `Total amount ${context.totalAmount.toFixed(2)} above ${policy.gate.threshold.toFixed(2)}`,
        };
      default:
        return { approved: true };
    }
  }

  private roundAmount(value: number): number {
    return Number(Number(value).toFixed(9));
  }
}
