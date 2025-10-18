import {
  AllocationPolicy,
  AnomalyFinding,
  AnomalyRule,
  CounterExample,
  DetectionContext,
  TransactionSample,
} from "./types";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const differenceInCalendarDays = (later: Date, earlier: Date) => {
  const diff = later.getTime() - earlier.getTime();
  return Math.floor(diff / MS_IN_DAY);
};

const DEFAULT_POLICY: AllocationPolicy = {
  windowDays: 30,
  categories: {
    Operations: { target: 0.45, tolerance: 0.15 },
    Payroll: { target: 0.35, tolerance: 0.1 },
    Marketing: { target: 0.2, tolerance: 0.1 },
  },
};

const toWindow = (
  history: readonly TransactionSample[],
  candidate: TransactionSample,
  days: number
) =>
  history.filter(
    (txn) =>
      txn.orgId === candidate.orgId &&
      differenceInCalendarDays(candidate.date, txn.date) >= 0 &&
      differenceInCalendarDays(candidate.date, txn.date) <= days
  );

const mean = (values: readonly number[]): number => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const pickNearestByAmount = (
  window: readonly TransactionSample[],
  target: number
): CounterExample | null => {
  if (!window.length) {
    return null;
  }
  const sorted = [...window].sort(
    (a, b) => Math.abs(target - Math.abs(a.amount)) - Math.abs(target - Math.abs(b.amount))
  );
  const sample = sorted[0];
  return {
    transaction: sample,
    reason: "Representative transaction used for baseline velocity",
  };
};

const velocitySpikeRule: AnomalyRule = {
  id: "velocity_spike",
  evaluate(candidate, history) {
    const last30 = toWindow(history, candidate, 30);
    const last90 = toWindow(history, candidate, 90);
    if (last30.length < 5 || last90.length < 12) {
      return null;
    }
    const baseline = Math.max(
      mean(last30.map((txn) => Math.abs(txn.amount))),
      mean(last90.map((txn) => Math.abs(txn.amount)))
    );
    if (baseline === 0) {
      return null;
    }
    const deviation = Math.abs(candidate.amount) / baseline;
    if (deviation < 3) {
      return null;
    }
    const counterExample = pickNearestByAmount(last90, baseline);
    if (!counterExample) {
      return null;
    }
    return {
      ruleId: this.id,
      severity: deviation > 6 ? "HIGH" : deviation > 4 ? "MEDIUM" : "LOW",
      summary: `Velocity spike: ${candidate.payee} amount ${candidate.amount.toFixed(
        2
      )} vs baseline ${baseline.toFixed(2)}`,
      context: {
        deviation,
        baseline,
        last30Count: last30.length,
        last90Count: last90.length,
      },
      counterExamples: [counterExample],
    } satisfies AnomalyFinding;
  },
};

const novelCounterpartyRule: AnomalyRule = {
  id: "novel_counterparty",
  evaluate(candidate, history) {
    const lookback = toWindow(history, candidate, 180);
    if (lookback.length < 8) {
      return null;
    }
    const seen = new Set(lookback.map((txn) => txn.payee.toLowerCase()));
    const current = candidate.payee.toLowerCase();
    if (seen.has(current)) {
      return null;
    }
    const freq = new Map<string, { count: number; sample: TransactionSample }>();
    for (const txn of lookback) {
      const key = txn.payee.toLowerCase();
      const record = freq.get(key) ?? { count: 0, sample: txn };
      record.count += 1;
      record.sample = txn;
      freq.set(key, record);
    }
    const [counterExample] = [...freq.values()].sort((a, b) => b.count - a.count);
    if (!counterExample) {
      return null;
    }
    return {
      ruleId: this.id,
      severity: "MEDIUM",
      summary: `Novel counterparty: ${candidate.payee} not seen in the last ${lookback.length} payments`,
      context: {
        knownCounterparties: freq.size,
        sampleCounterparty: counterExample.sample.payee,
      },
      counterExamples: [
        {
          transaction: counterExample.sample,
          reason: "Most common historical counterparty",
        },
      ],
    } satisfies AnomalyFinding;
  },
};

const allocationDriftRule: AnomalyRule = {
  id: "allocation_drift",
  evaluate(candidate, history, context) {
    const policy = context.policy ?? DEFAULT_POLICY;
    if (!candidate.category) {
      return null;
    }
    const window = toWindow(history, candidate, policy.windowDays);
    const relevant = window.filter((txn) => Boolean(txn.category));
    if (relevant.length < 10) {
      return null;
    }
    const totals = new Map<string, number>();
    for (const txn of relevant) {
      const key = txn.category as string;
      totals.set(key, (totals.get(key) ?? 0) + Math.max(Math.abs(txn.amount), 0));
    }
    const candidateCategory = candidate.category as string;
    totals.set(
      candidateCategory,
      (totals.get(candidateCategory) ?? 0) + Math.max(Math.abs(candidate.amount), 0)
    );
    const grandTotal = [...totals.values()].reduce((acc, value) => acc + value, 0);
    if (!grandTotal) {
      return null;
    }
    const breaches: Array<{ category: string; share: number; band: AllocationPolicy["categories"][string] }>
      = [];
    for (const [category, band] of Object.entries(policy.categories)) {
      const share = (totals.get(category) ?? 0) / grandTotal;
      if (Math.abs(share - band.target) > band.tolerance) {
        breaches.push({ category, share, band });
      }
    }
    if (!breaches.length) {
      return null;
    }
    let counterExample: CounterExample | null = null;
    if (totals.size > 1) {
      const sorted = [...relevant].sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
      for (const txn of sorted) {
        const band = policy.categories[txn.category as string];
        if (!band) {
          continue;
        }
        const share = (totals.get(txn.category as string) ?? 0) / grandTotal;
        if (Math.abs(share - band.target) <= band.tolerance) {
          counterExample = {
            transaction: txn,
            reason: "Category operating within policy band",
          };
          break;
        }
      }
    }
    if (!counterExample) {
      return null;
    }
    const strongest = breaches.sort((a, b) => Math.abs(b.share - b.band.target) - Math.abs(a.share - a.band.target))[0];
    return {
      ruleId: this.id,
      severity: "MEDIUM",
      summary: `Allocation drift: ${strongest.category} at ${(strongest.share * 100).toFixed(1)}% vs target ${(strongest.band.target * 100).toFixed(1)}%±${(strongest.band.tolerance * 100).toFixed(1)}%`,
      context: {
        breaches: breaches.map((entry) => ({
          category: entry.category,
          share: entry.share,
          target: entry.band.target,
          tolerance: entry.band.tolerance,
        })),
        grandTotal,
        windowDays: policy.windowDays,
      },
      counterExamples: [counterExample],
    } satisfies AnomalyFinding;
  },
};

export const DEFAULT_RULES: readonly AnomalyRule[] = [
  velocitySpikeRule,
  novelCounterpartyRule,
  allocationDriftRule,
];

export const ALL_RULES = {
  velocitySpikeRule,
  novelCounterpartyRule,
  allocationDriftRule,
};
