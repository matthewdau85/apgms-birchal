import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import {
  PersistedTransferRepository,
  TransferEventRecord,
  TransferRail,
  TransferRecord,
} from "@apgms/shared";
import { BecsAdapter } from "../src/adapters/becsAdapter";
import { BecsClient } from "../src/types";

class InMemoryStore implements PersistedTransferRepository {
  private transfers = new Map<string, TransferRecord>();
  private events = new Map<string, TransferEventRecord>();

  async createTransfer(input: {
    orgId: string;
    requestId: string;
    rail: TransferRail;
    amount: string;
    currency: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<TransferRecord> {
    for (const transfer of this.transfers.values()) {
      if (transfer.requestId === input.requestId) {
        return transfer;
      }
    }

    const now = new Date();
    const record: TransferRecord = {
      id: randomUUID(),
      orgId: input.orgId,
      requestId: input.requestId,
      rail: input.rail,
      amount: { currency: input.currency, value: Number(input.amount).toFixed(2) },
      status: "PENDING",
      externalId: null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.transfers.set(record.id, record);
    return record;
  }

  async findByRequestId(requestId: string): Promise<TransferRecord | null> {
    for (const transfer of this.transfers.values()) {
      if (transfer.requestId === requestId) {
        return transfer;
      }
    }
    return null;
  }

  async getById(id: string): Promise<TransferRecord | null> {
    return this.transfers.get(id) ?? null;
  }

  async updateTransfer(id: string, input: {
    status?: "PENDING" | "SUBMITTED" | "SETTLED" | "FAILED";
    externalId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<TransferRecord> {
    const current = this.transfers.get(id);
    if (!current) {
      throw new Error(`transfer ${id} not found`);
    }
    const updated: TransferRecord = {
      ...current,
      status: input.status ?? current.status,
      externalId: input.externalId ?? current.externalId,
      metadata: input.metadata ?? current.metadata,
      updatedAt: new Date(),
    };
    this.transfers.set(id, updated);
    return updated;
  }

  async saveEvent(input: {
    transferId: string;
    requestId: string;
    kind: string;
    payload: Record<string, unknown>;
  }): Promise<TransferEventRecord> {
    const existing = this.events.get(input.requestId);
    if (existing) {
      return existing;
    }
    const record: TransferEventRecord = {
      id: randomUUID(),
      transferId: input.transferId,
      requestId: input.requestId,
      kind: input.kind,
      payload: input.payload,
      createdAt: new Date(),
    };
    this.events.set(record.requestId, record);
    return record;
  }

  async getEventByRequestId(requestId: string): Promise<TransferEventRecord | null> {
    return this.events.get(requestId) ?? null;
  }

  async listEvents(transferId: string): Promise<TransferEventRecord[]> {
    return Array.from(this.events.values()).filter((event) => event.transferId === transferId);
  }
}

const baseRequest = {
  requestId: "req-1234567890",
  orgId: "org-1",
  customer: { name: "Ada Lovelace", reference: "INV-1" },
  account: { accountName: "Ada", bsb: "123456", accountNumber: "1234567" },
  amount: { currency: "AUD", value: "125.00" },
  description: "Test debit",
} as const;

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

test("createDebit is idempotent", async () => {
  const store = new InMemoryStore();
  let createCalls = 0;
  const client: BecsClient = {
    createDebit: async () => {
      createCalls += 1;
      return {
        externalId: "ext-1",
        status: "SUBMITTED",
        submittedAt: new Date().toISOString(),
        raw: {},
      };
    },
    getDebitStatus: async () => ({ status: "SUBMITTED", raw: {} } as any),
    cancelDebit: async () => ({ status: "FAILED", raw: {} } as any),
  };

  const adapter = new BecsAdapter({
    client,
    store,
    retryDelaysMs: [],
    sleepFn: async () => {},
    logger: silentLogger,
  });

  const first = await adapter.createDebit(baseRequest);
  const second = await adapter.createDebit(baseRequest);

  assert.equal(first.id, second.id);
  assert.equal(createCalls, 1);
  assert.equal(first.status, "SUBMITTED");
});

test("createDebit retries before succeeding", async () => {
  const store = new InMemoryStore();
  let attempts = 0;
  const client: BecsClient = {
    createDebit: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("temporary error");
      }
      return {
        externalId: "ext-2",
        status: "SUBMITTED",
        submittedAt: new Date().toISOString(),
        raw: {},
      };
    },
    getDebitStatus: async () => ({ status: "SUBMITTED", raw: {} } as any),
    cancelDebit: async () => ({ status: "FAILED", raw: {} } as any),
  };

  const adapter = new BecsAdapter({
    client,
    store,
    retryDelaysMs: [0, 0, 0],
    sleepFn: async () => {},
    logger: silentLogger,
  });

  const transfer = await adapter.createDebit(baseRequest);

  assert.equal(attempts, 3);
  assert.equal(transfer.status, "SUBMITTED");
  const events = await store.listEvents(transfer.id);
  assert.equal(events.length, 1);
});
