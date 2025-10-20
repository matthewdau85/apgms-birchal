import { randomUUID } from 'node:crypto';

import type { PaymentAdapter, PaymentAdapterContext, Remittance } from './types.js';

interface TransferRecord {
  status: 'INITIATED' | 'SETTLED';
  remittanceId: string;
  correlationId: string;
}

abstract class BaseMockAdapter implements PaymentAdapter {
  protected readonly transfers = new Map<string, TransferRecord>();
  createCalls = 0;
  statusCalls = 0;
  cancelCalls = 0;

  constructor(private readonly prefix: string) {}

  async create(remittance: Remittance, context: PaymentAdapterContext): Promise<{ transferId: string }> {
    this.createCalls += 1;
    const transferId = `${this.prefix}-${randomUUID()}`;
    this.transfers.set(transferId, {
      status: 'INITIATED',
      remittanceId: remittance.id,
      correlationId: context.correlationId,
    });

    return { transferId };
  }

  async status(transferId: string, context: PaymentAdapterContext): Promise<'INITIATED' | 'SETTLED'> {
    this.statusCalls += 1;
    const existing = this.transfers.get(transferId);
    if (!existing) {
      throw new Error(`Unknown transfer ${transferId}`);
    }

    // Mark the transfer as settled after the first status check to simulate downstream completion.
    existing.status = 'SETTLED';
    existing.correlationId = context.correlationId;
    return existing.status;
  }

  async cancel(transferId: string, context: PaymentAdapterContext): Promise<void> {
    this.cancelCalls += 1;
    if (this.transfers.has(transferId)) {
      this.transfers.delete(transferId);
    }
  }
}

export class MockPayToAdapter extends BaseMockAdapter {
  constructor() {
    super('payto');
  }
}

export class MockBECSAdapter extends BaseMockAdapter {
  constructor() {
    super('becs');
  }
}
