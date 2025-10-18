import { DEFAULT_RULES } from "./rules";
import {
  AnomalyFinding,
  DetectionContext,
  EngineOptions,
  TransactionSample,
} from "./types";

export class AnomalyEngine {
  private readonly rules;

  constructor(options?: EngineOptions) {
    this.rules = options?.rules ?? [...DEFAULT_RULES];
  }

  evaluate(
    candidate: TransactionSample,
    history: readonly TransactionSample[],
    context: DetectionContext = {}
  ): AnomalyFinding[] {
    const findings: AnomalyFinding[] = [];
    for (const rule of this.rules) {
      const result = rule.evaluate(candidate, history, context);
      if (result) {
        findings.push(result);
      }
    }
    return findings;
  }
}

export const evaluateWithDefaults = (
  candidate: TransactionSample,
  history: readonly TransactionSample[],
  context: DetectionContext = {}
) => new AnomalyEngine().evaluate(candidate, history, context);
