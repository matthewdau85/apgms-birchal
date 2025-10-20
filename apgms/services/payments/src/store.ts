import { randomUUID } from 'node:crypto';

import type {
  CreateRemittanceInput,
  Remittance,
  RemittanceEvent,
  RemittanceStatus,
} from './types.js';

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

const NOW = () => new Date().toISOString();

export class TransferStore {
  private readonly transfers = new Map<string, Mutable<Remittance>>();

  async createRemittance(input: CreateRemittanceInput): Promise<Remittance> {
    const id = randomUUID();
    const correlationId = input.correlationId ?? `remit-${id}`;
    const timestamp = NOW();
    const initialEvent: RemittanceEvent = {
      type: 'PENDING',
      at: timestamp,
      detail: { reason: 'remittance enqueued' },
    };

    const remittance: Mutable<Remittance> = {
      id,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      beneficiary: input.beneficiary,
      correlationId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'PENDING',
      events: [initialEvent],
    };

    this.transfers.set(id, remittance);
    return structuredClone(remittance);
  }

  async getRemittance(id: string): Promise<Remittance | undefined> {
    const existing = this.transfers.get(id);
    return existing ? structuredClone(existing) : undefined;
  }

  async transitionStatus(
    id: string,
    nextStatus: RemittanceStatus,
    detail: Record<string, unknown> = {},
  ): Promise<Remittance> {
    const current = this.transfers.get(id);
    if (!current) {
      throw new Error(`Remittance ${id} not found`);
    }

    if (!isValidTransition(current.status, nextStatus)) {
      throw new Error(`Invalid status transition from ${current.status} to ${nextStatus}`);
    }

    const timestamp = NOW();
    current.status = nextStatus;
    current.updatedAt = timestamp;
    current.events = [
      ...current.events,
      {
        type: nextStatus,
        at: timestamp,
        detail,
      },
    ];

    return structuredClone(current);
  }

  async setRemoteReference(id: string, reference: string): Promise<Remittance> {
    const current = this.transfers.get(id);
    if (!current) {
      throw new Error(`Remittance ${id} not found`);
    }

    current.remoteReference = reference;
    current.updatedAt = NOW();

    return structuredClone(current);
  }

  async listAll(): Promise<Remittance[]> {
    return Array.from(this.transfers.values()).map((transfer) => structuredClone(transfer));
  }
}

function isValidTransition(current: RemittanceStatus, next: RemittanceStatus): boolean {
  if (current === next) {
    return true;
  }

  if (current === 'PENDING' && next === 'INITIATED') {
    return true;
  }

  if (current === 'INITIATED' && next === 'SETTLED') {
    return true;
  }

  return false;
}
