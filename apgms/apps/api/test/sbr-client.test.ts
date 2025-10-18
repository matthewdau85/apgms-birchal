import { describe, expect, it } from "vitest";
import { SbrClient } from "../src/services/sbr-client";
import type { AuditBlobInput, AuditBlobRepository } from "../src/services/sbr-client";
import type { AppConfig } from "../src/config";

class InMemoryAuditRepository implements AuditBlobRepository {
  public readonly entries: AuditBlobInput[] = [];

  async save(input: AuditBlobInput): Promise<void> {
    this.entries.push(input);
  }
}

describe("SbrClient (development replay)", () => {
  const baseConfig: AppConfig = {
    nodeEnv: "development",
    sbr: {
      endpoint: "https://sandbox.sbr.gov.au/mock",
      username: "dev-user",
      password: "dev-password",
      fromPartyId: "FROM",
      toPartyId: "TO",
      service: "SubmitDocument",
      action: "Submit",
      replyTo: "https://listener.example.com/reply",
      mockResponses: true,
    },
  };

  it("persists request and simulated response payloads", async () => {
    const repo = new InMemoryAuditRepository();
    const ids = ["MSG-001", "RCPT-001"];
    const uuid = () => ids.shift() ?? "overflow";
    const clock = () => new Date("2024-07-09T05:00:00.000Z");

    const client = new SbrClient({
      auditRepository: repo,
      uuid,
      clock,
      config: baseConfig,
    });

    const result = await client.submitDocument({
      payload: "<Invoice>42</Invoice>",
    });

    expect(result.simulated).toBe(true);
    expect(result.messageId).toBe("MSG-001");
    expect(result.conversationId).toBe("MSG-001");
    expect(result.receipt).toContain("Simulated response for https://sandbox.sbr.gov.au/mock");

    expect(repo.entries).toHaveLength(2);

    const [request, response] = repo.entries;
    expect(request.direction).toBe("request");
    expect(request.payloadType).toBe("application/soap+xml");
    expect(request.payload).toContain("<Invoice>42</Invoice>");
    expect(request.payload).toContain("<eb:MessageId>MSG-001</eb:MessageId>");
    expect(request.payload).toContain("<eb:ReceiptReplyTo>https://listener.example.com/reply</eb:ReceiptReplyTo>");

    expect(response.direction).toBe("response");
    expect(response.payloadType).toBe("application/soap+xml");
    expect(response.payload).toContain("<eb:Status>ACCEPTED</eb:Status>");
    expect(response.payload).toContain("<eb:RefToMessageId>MSG-001</eb:RefToMessageId>");
  });
});
