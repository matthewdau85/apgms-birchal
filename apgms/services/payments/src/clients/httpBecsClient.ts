import {
  BecsClient,
  BecsClientCancelRequest,
  BecsClientCancelResponse,
  BecsClientCreateDebitRequest,
  BecsClientCreateDebitResponse,
  BecsClientGetStatusResponse,
} from "../types";

export interface HttpBecsClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export class HttpBecsClient implements BecsClient {
  constructor(private readonly options: HttpBecsClientOptions) {
    if (!options.baseUrl) {
      throw new Error("baseUrl is required for HttpBecsClient");
    }
    if (!options.apiKey) {
      throw new Error("apiKey is required for HttpBecsClient");
    }
  }

  async createDebit(request: BecsClientCreateDebitRequest): Promise<BecsClientCreateDebitResponse> {
    const response = await this.request("/debits", {
      method: "POST",
      body: JSON.stringify(request),
    });
    return {
      externalId: response.id,
      status: response.status,
      submittedAt: response.submittedAt,
      raw: response,
    };
  }

  async getDebitStatus(externalId: string): Promise<BecsClientGetStatusResponse> {
    const response = await this.request(`/debits/${externalId}`, {
      method: "GET",
    });
    return {
      status: response.status,
      settledAt: response.settledAt,
      raw: response,
    };
  }

  async cancelDebit(request: BecsClientCancelRequest): Promise<BecsClientCancelResponse> {
    const response = await this.request(`/debits/${request.externalId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: request.reason ?? null }),
    });
    return {
      status: response.status,
      cancelledAt: response.cancelledAt,
      raw: response,
    };
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10000);
    try {
      const response = await fetch(`${this.options.baseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await this.safeJson(response);
        throw new Error(`BECS API error ${response.status}: ${JSON.stringify(body)}`);
      }
      if (response.status === 204) {
        return {};
      }
      return this.safeJson(response);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async safeJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch (error) {
      return { raw: await response.text(), error: String(error) };
    }
  }
}
