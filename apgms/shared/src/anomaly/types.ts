export type AllocationBand = {
  target: number;
  tolerance: number;
};

export type AllocationPolicy = {
  windowDays: number;
  categories: Record<string, AllocationBand>;
};

export type TransactionSample = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  category?: string | null;
};

export type DetectionContext = {
  policy?: AllocationPolicy;
  now?: Date;
};

export type CounterExample = {
  transaction: TransactionSample;
  reason: string;
};

export type AnomalyFinding = {
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  context: Record<string, unknown>;
  counterExamples: CounterExample[];
};

export interface AnomalyRule {
  id: string;
  evaluate(
    candidate: TransactionSample,
    history: readonly TransactionSample[],
    context: DetectionContext
  ): AnomalyFinding | null;
}

export type EngineOptions = {
  rules?: AnomalyRule[];
};
