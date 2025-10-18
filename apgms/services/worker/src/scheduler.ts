import { randomUUID } from 'node:crypto';

import {
  type PaymentAdapter,
  type PaymentMethod,
  type Remittance,
  type RemittanceStatus,
  Gate,
  InMemoryRemittanceQueue,
  PaymentsMetrics,
  TransferStore,
} from '../../payments/src/index.js';

interface SchedulerOptions {
  readonly store: TransferStore;
  readonly queue: InMemoryRemittanceQueue;
  readonly gate: Gate;
  readonly metrics: PaymentsMetrics;
  readonly adapters: Record<PaymentMethod, PaymentAdapter>;
  readonly backoffMs?: (attempt: number) => number;
}

export class RemittanceScheduler {
  private readonly workerId = `worker-${randomUUID()}`;

  constructor(private readonly options: SchedulerOptions) {}

  async runOnce(): Promise<boolean> {
    const lease = await this.options.queue.leaseNext({ owner: this.workerId });
    if (!lease) {
      return false;
    }

    try {
      const remittance = await this.options.store.getRemittance(lease.id);
      if (!remittance) {
        this.options.queue.ack(lease.id, this.workerId);
        return false;
      }

      await this.process(remittance, lease.attempt);
      this.options.queue.ack(lease.id, this.workerId);
      return true;
    } catch (error) {
      const backoff = this.options.backoffMs?.(lease.attempt) ?? 250 * lease.attempt;
      this.options.metrics.remittanceRetries.inc();
      this.options.queue.release(lease.id, this.workerId, { requeue: true, delayMs: backoff });
      return false;
    }
  }

  private async process(remittance: Remittance, attempt: number): Promise<void> {
    if (remittance.status === 'SETTLED') {
      return;
    }

    if (remittance.status === 'PENDING') {
      await this.transition(remittance.id, 'INITIATED', {
        correlationId: remittance.correlationId,
        attempt,
      });
    }

    const refreshed = await this.options.store.getRemittance(remittance.id);
    if (!refreshed) {
      return;
    }

    const adapter = this.options.adapters[refreshed.method];
    const context = { correlationId: refreshed.correlationId } as const;

    if (!refreshed.remoteReference) {
      const result = await adapter.create(refreshed, context);
      await this.options.store.setRemoteReference(refreshed.id, result.transferId);
      this.options.metrics.remittanceInitiated.inc();
    }

    const reference = (await this.options.store.getRemittance(refreshed.id))?.remoteReference;
    if (!reference) {
      return;
    }

    const status = await adapter.status(reference, context);
    if (status === 'SETTLED') {
      await this.transition(refreshed.id, 'SETTLED', {
        correlationId: refreshed.correlationId,
        reference,
      });
      this.options.metrics.remittanceSettled.inc();
    }
  }

  private async transition(
    id: string,
    status: RemittanceStatus,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.options.store.transitionStatus(id, status, detail);
  }
}
