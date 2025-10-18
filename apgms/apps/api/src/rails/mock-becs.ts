import { setTimeout as delay } from "node:timers/promises";
import {
  RailAdapter,
  RailLifecycleCallbacks,
  RailCode,
  RemittanceInstruction,
} from "./types";

export class MockBecs implements RailAdapter {
  readonly id = "mock-becs";
  readonly rail: RailCode = "becs";

  constructor(
    private readonly config: {
      initiationDelayMs?: number;
      settlementDelayMs?: number;
      failureAmountThreshold?: number;
    } = {},
  ) {}

  async initiate(
    remittance: RemittanceInstruction,
    callbacks: RailLifecycleCallbacks,
  ): Promise<void> {
    const initiationDelay = this.config.initiationDelayMs ?? 250;
    const settlementDelay = this.config.settlementDelayMs ?? 1_200;
    const failureThreshold = this.config.failureAmountThreshold ?? 75_000;

    await delay(initiationDelay);

    callbacks.onInitiated({
      remittanceId: remittance.id,
      initiatedAt: new Date(),
      reference: `BECS-${remittance.id.slice(0, 6).toUpperCase()}`,
      raw: {
        rail: this.rail,
        lodgementReference: remittance.description ?? "",
      },
    });

    setTimeout(() => {
      if (remittance.amount >= failureThreshold) {
        callbacks.onFailed({
          remittanceId: remittance.id,
          failedAt: new Date(),
          reason: `Amount ${remittance.amount.toFixed(2)} exceeds BECS mock limit`,
        });
        return;
      }

      callbacks.onSettled({
        remittanceId: remittance.id,
        settledAt: new Date(),
        receipt: `BECS-RCT-${remittance.id.slice(-5).toUpperCase()}`,
      });
    }, settlementDelay);
  }
}
