import assert from "node:assert/strict";
import test from "node:test";
import { SoapClient } from "../src/clients";
import { BasSubmissionHandler } from "../src/handlers";

const basSuccess = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SubmitBASResponse>
      <ReceiptNumber>ABC123</ReceiptNumber>
      <ProcessingStatus>ACCEPTED</ProcessingStatus>
      <LodgementTime>2024-06-01T00:00:00Z</LodgementTime>
    </SubmitBASResponse>
  </soap:Body>
</soap:Envelope>`;

const basFault = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>ATO.SERVICE.UNAVAILABLE</faultcode>
      <faultstring>Service unavailable</faultstring>
      <detail>
        <ato:Code xmlns:ato="http://ato.gov.au/errors">ATO.SERVICE.UNAVAILABLE</ato:Code>
      </detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;

function createClient(responses: string[]) {
  let count = 0;
  return new SoapClient({
    endpoint: "https://example.com",
    productId: "PID",
    credentials: {
      type: "mygovid",
      abn: "12345678901",
      deviceId: "device",
      authToken: "token",
    },
    transport: async () => {
      const body = responses[count++] ?? responses[responses.length - 1];
      return { status: body === basFault ? 500 : 200, headers: {}, body };
    },
  });
}

const payload = {
  abn: "12345678901",
  period: "2024-06",
  grossSales: 10000,
  gstOnSales: 1000,
  gstOnPurchases: 400,
};

test("BAS handler submits and returns a receipt", async () => {
  const handler = new BasSubmissionHandler({
    client: createClient([basSuccess]),
    sleep: async () => {},
  });

  const result = await handler.submit(payload);
  assert.equal(result.receiptId, "ABC123");
});

test("BAS handler retries transient faults", async () => {
  const handler = new BasSubmissionHandler({
    client: createClient([basFault, basSuccess]),
    sleep: async () => {},
  });

  const result = await handler.submit(payload);
  assert.equal(result.status, "ACCEPTED");
});

test("BAS handler surfaces decoded submission errors", async () => {
  const client = new SoapClient({
    endpoint: "https://example.com",
    productId: "PID",
    credentials: {
      type: "mygovid",
      abn: "12345678901",
      deviceId: "device",
      authToken: "token",
    },
    transport: async () => ({
      status: 400,
      headers: {},
      body: `<?xml version="1.0"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <soap:Fault>
            <faultcode>ATO.BAS.FORM.INVALID</faultcode>
            <faultstring>Validation failed</faultstring>
            <detail>
              <ato:Code xmlns:ato="http://ato.gov.au/errors">ATO.BAS.FORM.INVALID</ato:Code>
            </detail>
          </soap:Fault>
        </soap:Body>
      </soap:Envelope>`,
    }),
  });

  const handler = new BasSubmissionHandler({ client, sleep: async () => {} });

  await assert.rejects(async () => handler.submit(payload), (error: unknown) => {
    return typeof error === "object" && error !== null && (error as any).decodedFault?.retryable === false;
  });
});
