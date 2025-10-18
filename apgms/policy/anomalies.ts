import { AlertSeverity } from "../shared/src/alerts";

type PrimitiveRecord = Record<string, unknown>;

export interface CandidateTransaction {
  id: string;
  orgId: string;
  amount: number;
  occurredAt: Date;
  payee?: string;
  description?: string;
  bankLineId?: string;
}

export interface DetectionContext {
  recentTransactions?: CandidateTransaction[];
  watchlist?: string[];
  baselines?: Record<string, { average: number; stdev?: number } | number>;
}

export interface RuleEvaluation {
  triggered: boolean;
  message?: string;
  metadata?: PrimitiveRecord;
}

export interface RuleDefinition<TOptions extends PrimitiveRecord = PrimitiveRecord> {
  id: string;
  description: string;
  severity: AlertSeverity;
  defaultOptions: TOptions;
  evaluate: (
    candidate: CandidateTransaction,
    context: DetectionContext,
    options: TOptions
  ) => RuleEvaluation;
}

export interface RuleConfiguration<TOptions extends PrimitiveRecord = PrimitiveRecord> {
  id: string;
  enabled?: boolean;
  options?: Partial<TOptions>;
  severity?: AlertSeverity;
  summary?: string;
}

export interface AnomalyFinding extends RuleEvaluation {
  ruleId: string;
  candidateId: string;
  summary: string;
  severity: AlertSeverity;
}

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const minutesToMs = (minutes: number): number => Math.max(minutes, 0) * 60 * 1000;

const normalizeWatchlist = (context: DetectionContext, options: PrimitiveRecord): Set<string> => {
  const fromContext = context.watchlist ?? [];
  const fromOptions = asArray<string>(options.watchlist as string[] | string | undefined);
  return new Set([...fromContext, ...fromOptions].map((item) => item.toLowerCase()));
};

const absolute = (value: number): number => Math.abs(Number.isFinite(value) ? value : Number(value));

const findBaseline = (
  candidate: CandidateTransaction,
  context: DetectionContext,
  fallback: number
): number | undefined => {
  if (!candidate.payee) return undefined;
  const baseline = context.baselines?.[candidate.payee] ?? context.baselines?.default ?? fallback;
  if (baseline == null) return undefined;
  if (typeof baseline === "number") return baseline;
  if (typeof baseline === "object" && "average" in baseline) {
    return Number((baseline as { average: number }).average);
  }
  return undefined;
};

const largeAmountRule: RuleDefinition<{ threshold: number }> = {
  id: "large-amount",
  description: "Amounts that exceed the configured threshold",
  severity: "HIGH",
  defaultOptions: {
    threshold: 10_000,
  },
  evaluate: (candidate, _context, options) => {
    const threshold = Number(options.threshold ?? 0);
    const amount = absolute(candidate.amount);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return { triggered: false };
    }
    if (amount >= threshold) {
      return {
        triggered: true,
        message: `Amount ${amount.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}`,
        metadata: { threshold, amount },
      };
    }
    return { triggered: false };
  },
};

const watchlistPayeeRule: RuleDefinition<{ watchlist?: string[] }> = {
  id: "watchlist-payee",
  description: "Transactions with a counterparty from the watchlist",
  severity: "CRITICAL",
  defaultOptions: {
    watchlist: [],
  },
  evaluate: (candidate, context, options) => {
    if (!candidate.payee) {
      return { triggered: false };
    }
    const watchlist = normalizeWatchlist(context, options);
    if (watchlist.size === 0) {
      return { triggered: false };
    }
    const payee = candidate.payee.toLowerCase();
    if (watchlist.has(payee)) {
      return {
        triggered: true,
        message: `${candidate.payee} is on the watchlist`,
        metadata: { payee: candidate.payee },
      };
    }
    return { triggered: false };
  },
};

const rapidRepeatRule: RuleDefinition<{ windowMinutes: number; maxPerPayee: number }> = {
  id: "rapid-repeat",
  description: "Multiple payments to the same counterparty in a short period",
  severity: "MEDIUM",
  defaultOptions: {
    windowMinutes: 60,
    maxPerPayee: 3,
  },
  evaluate: (candidate, context, options) => {
    const { windowMinutes, maxPerPayee } = options;
    if (!candidate.payee || !context.recentTransactions?.length) {
      return { triggered: false };
    }
    const windowMs = minutesToMs(windowMinutes);
    const windowStart = candidate.occurredAt.getTime() - windowMs;
    const count = context.recentTransactions.filter((txn) => {
      if (!txn.payee) return false;
      return (
        txn.payee.toLowerCase() === candidate.payee!.toLowerCase() &&
        txn.occurredAt.getTime() >= windowStart &&
        txn.occurredAt.getTime() <= candidate.occurredAt.getTime()
      );
    }).length + 1;
    if (count > maxPerPayee) {
      return {
        triggered: true,
        message: `${count} payments to ${candidate.payee} within ${windowMinutes} minutes`,
        metadata: { count, windowMinutes, payee: candidate.payee },
      };
    }
    return { triggered: false };
  },
};

const deviationRule: RuleDefinition<{ multiplier: number; fallbackAverage: number }> = {
  id: "average-deviation",
  description: "Payments that deviate significantly from historic averages",
  severity: "MEDIUM",
  defaultOptions: {
    multiplier: 3,
    fallbackAverage: 5_000,
  },
  evaluate: (candidate, context, options) => {
    const baseline = findBaseline(candidate, context, options.fallbackAverage);
    if (!baseline) return { triggered: false };
    const multiplier = Number(options.multiplier ?? 1);
    if (multiplier <= 0) return { triggered: false };
    const limit = baseline * multiplier;
    const amount = absolute(candidate.amount);
    if (amount > limit) {
      return {
        triggered: true,
        message: `Amount ${amount.toFixed(2)} exceeds baseline ${baseline.toFixed(2)} by multiplier ${multiplier}`,
        metadata: { amount, baseline, multiplier },
      };
    }
    return { triggered: false };
  },
};

export const defaultAnomalyRules: RuleDefinition[] = [
  largeAmountRule,
  watchlistPayeeRule,
  rapidRepeatRule,
  deviationRule,
];

export class AnomalyRuleEngine {
  private readonly configById: Map<string, RuleConfiguration>;

  constructor(private readonly rules: RuleDefinition[], configurations: RuleConfiguration[] = []) {
    this.configById = new Map(configurations.map((cfg) => [cfg.id, cfg]));
  }

  withConfiguration(configurations: RuleConfiguration[]): AnomalyRuleEngine {
    return new AnomalyRuleEngine(this.rules, configurations);
  }

  evaluate(candidate: CandidateTransaction, context: DetectionContext = {}): AnomalyFinding[] {
    const findings: AnomalyFinding[] = [];
    for (const rule of this.rules) {
      const config = this.configById.get(rule.id);
      if (config?.enabled === false) {
        continue;
      }
      const mergedOptions = {
        ...rule.defaultOptions,
        ...(config?.options ?? {}),
      } as PrimitiveRecord;
      const evaluation = rule.evaluate(candidate, context, mergedOptions as any);
      if (!evaluation.triggered) {
        continue;
      }
      const severity = config?.severity ?? rule.severity;
      const summary = config?.summary ?? rule.description;
      findings.push({
        ruleId: rule.id,
        candidateId: candidate.id,
        severity,
        summary,
        message: evaluation.message,
        metadata: evaluation.metadata,
        triggered: true,
      });
    }
    return findings;
  }
}

export const createRuleEngine = (
  rules: RuleDefinition[] = defaultAnomalyRules,
  configurations: RuleConfiguration[] = []
): AnomalyRuleEngine => new AnomalyRuleEngine(rules, configurations);
