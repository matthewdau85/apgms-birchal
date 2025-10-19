import { AnomalyEvaluation, AnomalyPipeline } from "./types";

export class NoopAnomalyPipeline implements AnomalyPipeline {
  async evaluate(): Promise<AnomalyEvaluation> {
    return { severity: "NONE" };
  }
}
