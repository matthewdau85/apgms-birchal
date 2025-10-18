import { setTimeout as delay } from "node:timers/promises";
import {
  BecsClient,
  BecsClientCancelRequest,
  BecsClientCancelResponse,
  BecsClientCreateDebitRequest,
  BecsClientCreateDebitResponse,
  BecsClientGetStatusResponse,
} from "../types";

interface StoredDebit {
  request: BecsClientCreateDebitRequest;
  response: BecsClientCreateDebitResponse;
}

export interface InMemoryBecsClientOptions {
  latencyMs?: number;
}

export class InMemoryBecsClient implements BecsClient {
  private readonly latency: number;
  private readonly store = new Map<string, StoredDebit>();

  constructor(options: InMemoryBecsClientOptions = {}) {
    this.latency = options.latencyMs ?? 25;
  }

  async createDebit(request: BecsClientCreateDebitRequest): Promise<BecsClientCreateDebitResponse> {
    await delay(this.latency);
    const existing = this.store.get(request.requestId);
    if (existing) {
      return existing.response;
    }
    const response: BecsClientCreateDebitResponse = {
      externalId: request.requestId,
      status: "SUBMITTED",
      submittedAt: new Date().toISOString(),
      raw: { echo: request },
    };
    this.store.set(request.requestId, { request, response });
    return response;
  }

  async getDebitStatus(externalId: string): Promise<BecsClientGetStatusResponse> {
    await delay(this.latency);
    const item = this.findByExternalId(externalId);
    return {
      status: item?.response.status ?? "FAILED",
      settledAt: item?.response.status === "SETTLED" ? new Date().toISOString() : undefined,
      raw: item,
    };
  }

  async cancelDebit(request: BecsClientCancelRequest): Promise<BecsClientCancelResponse> {
    await delay(this.latency);
    const item = this.findByExternalId(request.externalId);
    if (!item) {
      return {
        status: "FAILED",
        cancelledAt: new Date().toISOString(),
        raw: { reason: request.reason ?? null },
      };
    }
    item.response.status = "FAILED";
    return {
      status: "FAILED",
      cancelledAt: new Date().toISOString(),
      raw: { reason: request.reason ?? null },
    };
  }

  private findByExternalId(externalId: string): StoredDebit | undefined {
    for (const record of this.store.values()) {
      if (record.response.externalId === externalId) {
        return record;
      }
    }
    return undefined;
  }
}
