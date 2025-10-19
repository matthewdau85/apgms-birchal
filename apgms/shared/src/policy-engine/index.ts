export type GateState = "open" | "closed" | "suspended";

export interface GateConfig {
  id: string;
  state: GateState;
  weight: number;
}

export interface AllocationRequest {
  amount: number;
  gates: GateConfig[];
}

export interface AllocationRecord {
  gateId: string;
  amount: number;
  state: GateState;
}

export interface AllocationResult {
  allocations: AllocationRecord[];
  amount: number;
}

export class AllocationError extends Error {}

const sortGates = (gates: GateConfig[]): GateConfig[] =>
  [...gates].sort((a, b) => a.id.localeCompare(b.id));

const assertSafeInteger = (value: bigint) => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new AllocationError("Value exceeds safe integer bounds");
  }
};

const toBigInt = (value: number): bigint => {
  if (!Number.isFinite(value)) {
    throw new AllocationError("Amount must be a finite number");
  }
  if (!Number.isInteger(value)) {
    throw new AllocationError("Amount must be an integer");
  }
  if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new AllocationError("Amount exceeds safe integer bounds");
  }
  return BigInt(value);
};

const toWeight = (value: number): bigint => {
  if (!Number.isFinite(value)) {
    throw new AllocationError("Weight must be finite");
  }
  if (!Number.isInteger(value)) {
    throw new AllocationError("Weight must be an integer");
  }
  if (value < 0) {
    throw new AllocationError("Weight must be non-negative");
  }
  if (value > Number.MAX_SAFE_INTEGER) {
    throw new AllocationError("Weight exceeds safe integer bounds");
  }
  return BigInt(value);
};

export const computeDeterministicAllocation = (
  request: AllocationRequest,
): AllocationResult => {
  const amount = toBigInt(request.amount);
  if (amount < 0n) {
    throw new AllocationError("Amount must be non-negative");
  }
  const sorted = sortGates(request.gates);
  if (sorted.length === 0) {
    return { allocations: [], amount: Number(amount) };
  }

  const openGates = sorted.filter((gate) => gate.state === "open");
  const weightMap = new Map<string, bigint>();
  let totalWeight = 0n;
  for (const gate of openGates) {
    const weight = toWeight(gate.weight);
    weightMap.set(gate.id, weight);
    totalWeight += weight;
  }

  if (amount > 0n && totalWeight === 0n) {
    throw new AllocationError("No open gates with weight to allocate");
  }

  const allocationMap = new Map<string, bigint>();
  for (const gate of sorted) {
    allocationMap.set(gate.id, 0n);
  }

  let remainder = amount;
  if (totalWeight > 0n) {
    for (const gate of openGates) {
      const weight = weightMap.get(gate.id) ?? 0n;
      if (weight === 0n) {
        continue;
      }
      const share = (amount * weight) / totalWeight;
      allocationMap.set(gate.id, share);
      remainder -= share;
    }

    if (remainder > 0n) {
      for (const gate of openGates) {
        if (remainder === 0n) {
          break;
        }
        const weight = weightMap.get(gate.id) ?? 0n;
        if (weight === 0n) {
          continue;
        }
        const current = allocationMap.get(gate.id) ?? 0n;
        allocationMap.set(gate.id, current + 1n);
        remainder -= 1n;
      }
    }
  }

  if (remainder !== 0n) {
    throw new AllocationError("Invariant violation: allocations did not conserve");
  }

  const allocations: AllocationRecord[] = sorted.map((gate) => {
    const value = allocationMap.get(gate.id) ?? 0n;
    assertSafeInteger(value);
    return {
      gateId: gate.id,
      amount: Number(value),
      state: gate.state,
    };
  });

  assertSafeInteger(amount);
  return { allocations, amount: Number(amount) };
};
