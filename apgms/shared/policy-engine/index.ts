import { createHash } from 'crypto';

export type BankLine = {
  id: string;
  orgId: string;
  amountCents: number;
  date: string;
  payee: string;
  desc: string;
};

export type Ruleset = {
  gstRate: number;
  paygwRate: number;
  taxBufferRate: number;
  gates: {
    remit: boolean;
  };
};

export type AccountStates = Record<string, unknown>;

export type Allocation = {
  bucket: 'OPERATING' | 'TAX_BUFFER' | 'PAYGW' | 'GST';
  amountCents: number;
  currency: 'AUD';
};

export type Preview = {
  allocations: Allocation[];
  policyHash: string;
  explain: string;
};

const POLICY_VERSION = 'v1';

const BUCKET_ORDER: Allocation['bucket'][] = [
  'GST',
  'PAYGW',
  'TAX_BUFFER',
  'OPERATING',
];

function bankersRound(value: number): number {
  const integer = Math.trunc(value);
  const fraction = value - integer;

  if (fraction > 0.5) {
    return integer + 1;
  }

  if (fraction < 0.5) {
    return integer;
  }

  return integer % 2 === 0 ? integer : integer + 1;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]);

    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = val;
      return acc;
    }, {});
  }

  return value;
}

function policyHashForRuleset(ruleset: Ruleset): string {
  const canonicalJson = JSON.stringify(
    canonicalize({
      ruleset,
      version: POLICY_VERSION,
    }),
  );

  return createHash('sha256').update(canonicalJson).digest('hex');
}

function allocationAmount(baseAmount: number, rate: number): number {
  if (rate <= 0) {
    return 0;
  }

  const raw = baseAmount * rate;
  return bankersRound(raw);
}

export function previewAllocations(input: {
  bankLine: BankLine;
  ruleset: Ruleset;
  accountStates: AccountStates;
}): Preview {
  const { bankLine, ruleset } = input;
  const baseAmount = bankLine.amountCents;

  const gst: Allocation = { bucket: 'GST', amountCents: allocationAmount(baseAmount, ruleset.gstRate), currency: 'AUD' };
  const paygw: Allocation = { bucket: 'PAYGW', amountCents: allocationAmount(baseAmount, ruleset.paygwRate), currency: 'AUD' };
  const taxBuffer: Allocation = {
    bucket: 'TAX_BUFFER',
    amountCents: allocationAmount(baseAmount, ruleset.taxBufferRate),
    currency: 'AUD',
  };

  let operating: Allocation = {
    bucket: 'OPERATING',
    amountCents: baseAmount - (gst.amountCents + paygw.amountCents + taxBuffer.amountCents),
    currency: 'AUD',
  };

  if (operating.amountCents < 0) {
    let overAllocated = -operating.amountCents;
    operating = { ...operating, amountCents: 0 };

    const adjustable = [taxBuffer, paygw, gst];
    for (const allocation of adjustable) {
      if (overAllocated <= 0) {
        break;
      }

      const deduction = Math.min(allocation.amountCents, overAllocated);
      allocation.amountCents -= deduction;
      overAllocated -= deduction;
    }
  }

  const allocations: Allocation[] = [gst, paygw, taxBuffer, operating];

  const sum = allocations.reduce((acc, allocation) => acc + allocation.amountCents, 0);
  let difference = baseAmount - sum;

  if (difference > 0) {
    operating.amountCents += difference;
  } else if (difference < 0) {
    difference = -difference;
    const adjustable = [operating, taxBuffer, paygw, gst];
    for (const allocation of adjustable) {
      if (difference <= 0) {
        break;
      }

      const deduction = Math.min(allocation.amountCents, difference);
      allocation.amountCents -= deduction;
      difference -= deduction;
    }
  }

  const policyHash = policyHashForRuleset(ruleset);

  const explain = `Allocated according to GST ${ruleset.gstRate}, PAYGW ${ruleset.paygwRate}, tax buffer ${ruleset.taxBufferRate}. Remittance gate is ${ruleset.gates.remit ? 'enabled' : 'disabled'}.`;

  return {
    allocations: BUCKET_ORDER.map((bucket) => allocations.find((entry) => entry.bucket === bucket)!),
    policyHash,
    explain,
  };
}
