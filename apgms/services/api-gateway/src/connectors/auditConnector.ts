import { FastifyBaseLogger } from "fastify";

export interface AuditEventPayload {
  event: string;
  data: Record<string, unknown>;
  actor: {
    id: string;
    email?: string;
  };
}

export interface AuditConnector {
  record(event: AuditEventPayload): Promise<void>;
}

export class HttpAuditConnector implements AuditConnector {
  constructor(private readonly options: { baseUrl?: string; fetchImpl?: typeof fetch; logger: FastifyBaseLogger }) {}

  async record(event: AuditEventPayload) {
    if (!this.options.baseUrl) {
      this.options.logger.debug({ event }, "Audit connector skipped (no base URL configured)");
      return;
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(`${this.options.baseUrl}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const body = await response.text();
      this.options.logger.error({ status: response.status, body }, "Failed to send audit event");
      throw new Error(`Failed to record audit event (${response.status})`);
    }
  }
}
