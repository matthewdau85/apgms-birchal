import { createHash } from 'node:crypto';

type BankLine = {
  id: string;
  orgId: string;
  amountCents: number;
  date: string;
  payee: string;
  desc: string;
};

type Ruleset = {
  gstRate: number;
  paygwRate: number;
  taxBufferRate: number;
  gates: {
    remit: boolean;
  };
};

type AccountStates = Record<string, unknown>;

type Allocation = {
  bucket: 'OPERATING' | 'TAX_BUFFER' | 'PAYGW' | 'GST';
  amountCents: number;
  currency: 'AUD';
};

type Preview = {
  allocations: Allocation[];
  policyHash: string;
  explain: string;
};

const POLICY_VERSION = 'v1';

const ALLOCATION_ORDER: Array<Omit<Allocation, 'amountCents'>> = [
  { bucket: 'GST', currency: 'AUD' },
  { bucket: 'PAYGW', currency: 'AUD' },
  { bucket: 'TAX_BUFFER', currency: 'AUD' },
  { bucket: 'OPERATING', currency: 'AUD' },
];

const REDUCTION_PRIORITY: Array<Allocation['bucket']> = [
  'TAX_BUFFER',
  'PAYGW',
  'GST',
];

function bankersRound(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Cannot round non-finite number');
  }

  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const fraction = abs - floor;

  let result: number;
  if (fraction < 0.5) {
    result = floor;
  } else if (fraction > 0.5) {
    result = floor + 1;
  } else {
    result = floor % 2 === 0 ? floor : floor + 1;
  }

  return result * sign;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item));
    return `[${items.join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);

  return `{${entries.join(',')}}`;
}

function computePolicyHash(ruleset: Ruleset): string {
  const canonical = stableStringify({ ruleset, version: POLICY_VERSION });
  return createHash('sha256').update(canonical).digest('hex');
}

function clampAllocationsToTotal(
  allocations: Allocation[],
  total: number,
): Allocation[] {
  const operating = allocations.find((allocation) => allocation.bucket === 'OPERATING');
  if (!operating) {
    throw new Error('OPERATING allocation missing');
  }

  const nonOperating = allocations.filter((allocation) => allocation.bucket !== 'OPERATING');

  let reserved = nonOperating.reduce((acc, allocation) => acc + allocation.amountCents, 0);
  let operatingAmount = total - reserved;

  if (operatingAmount >= 0) {
    operating.amountCents = operatingAmount;
    return allocations;
  }

  let deficit = -operatingAmount;
  for (const bucket of REDUCTION_PRIORITY) {
    const allocation = nonOperating.find((item) => item.bucket === bucket);
    if (!allocation) {
      continue;
    }

    if (deficit <= 0) {
      break;
    }

    const reduction = Math.min(allocation.amountCents, deficit);
    allocation.amountCents -= reduction;
    deficit -= reduction;
  }

  reserved = nonOperating.reduce((acc, allocation) => acc + allocation.amountCents, 0);
  operatingAmount = Math.max(0, total - reserved);
  operating.amountCents = operatingAmount;

  return allocations;
}

export type {
  BankLine,
  Ruleset,
  AccountStates,
  Allocation,
  Preview,
};

export function previewAllocations(input: {
  bankLine: BankLine;
  ruleset: Ruleset;
  accountStates: AccountStates;
}): Preview {
  const { bankLine, ruleset } = input;
  const totalCents = bankLine.amountCents;

  const gst = bankersRound(totalCents * ruleset.gstRate);
  const paygw = bankersRound(totalCents * ruleset.paygwRate);
  const taxBuffer = bankersRound(totalCents * ruleset.taxBufferRate);

  const initialAllocations: Allocation[] = [
    { ...ALLOCATION_ORDER[0], amountCents: Math.max(0, gst) },
    { ...ALLOCATION_ORDER[1], amountCents: Math.max(0, paygw) },
    { ...ALLOCATION_ORDER[2], amountCents: Math.max(0, taxBuffer) },
    { ...ALLOCATION_ORDER[3], amountCents: 0 },
  ];

  clampAllocationsToTotal(initialAllocations, totalCents);

  const allocations = initialAllocations;

  const policyHash = computePolicyHash(ruleset);
  const explain = `Policy ${POLICY_VERSION} allocations with remit gate ${ruleset.gates.remit ? 'enabled' : 'disabled'}.`;

  return {
    allocations,
    policyHash,
    explain,
  };
}
