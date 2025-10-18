import { setTimeout as delay } from "node:timers/promises";
import {
  RailAdapter,
  RailLifecycleCallbacks,
  RailCode,
  RemittanceInstruction,
} from "./types";

export class MockPayTo implements RailAdapter {
  readonly id = "mock-payto";
  readonly rail: RailCode = "payto";

  constructor(
    private readonly config: {
      initiationDelayMs?: number;
      settlementDelayMs?: number;
    } = {},
  ) {}

  async initiate(
    remittance: RemittanceInstruction,
    callbacks: RailLifecycleCallbacks,
  ): Promise<void> {
    const initiationDelay = this.config.initiationDelayMs ?? 75;
    const settlementDelay = this.config.settlementDelayMs ?? 400;

    await delay(initiationDelay);

    callbacks.onInitiated({
      remittanceId: remittance.id,
      initiatedAt: new Date(),
      reference: `PAYTO-${remittance.id.slice(0, 8).toUpperCase()}`,
      raw: {
        rail: this.rail,
        beneficiaryName: remittance.beneficiaryName,
        amount: remittance.amount,
      },
    });

    setTimeout(() => {
      callbacks.onSettled({
        remittanceId: remittance.id,
        settledAt: new Date(),
        receipt: `PAYTO-RCPT-${remittance.id.slice(-6).toUpperCase()}`,
      });
    }, settlementDelay);
  }
}
