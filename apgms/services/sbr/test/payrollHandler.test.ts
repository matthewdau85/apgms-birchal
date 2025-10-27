import assert from "node:assert/strict";
import test from "node:test";
import { SoapClient } from "../src/clients";
import { PayrollSubmissionHandler } from "../src/handlers";

const payrollSuccess = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SubmitPayrollResponse>
      <ReceiptNumber>PAY123</ReceiptNumber>
      <ProcessingStatus>RECEIVED</ProcessingStatus>
      <LodgementTime>2024-06-02T00:00:00Z</LodgementTime>
    </SubmitPayrollResponse>
  </soap:Body>
</soap:Envelope>`;

const payrollFault = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>ATO.PAYROLL.OUTAGE</faultcode>
      <faultstring>Outage</faultstring>
      <detail>
        <ato:Code xmlns:ato="http://ato.gov.au/errors">ATO.PAYROLL.OUTAGE</ato:Code>
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
      return { status: body === payrollFault ? 500 : 200, headers: {}, body };
    },
  });
}

const payload = {
  abn: "12345678901",
  payPeriodStart: "2024-05-26",
  payPeriodEnd: "2024-06-01",
  employees: [
    { tfnd: "123456789", gross: 5000, taxWithheld: 1200 },
    { tfnd: "987654321", gross: 4200, taxWithheld: 900 },
  ],
};

test("Payroll handler submits events", async () => {
  const handler = new PayrollSubmissionHandler({
    client: createClient([payrollSuccess]),
    sleep: async () => {},
  });

  const result = await handler.submit(payload);
  assert.equal(result.receiptId, "PAY123");
  assert.equal(result.status, "RECEIVED");
});

test("Payroll handler retries outages", async () => {
  const handler = new PayrollSubmissionHandler({
    client: createClient([payrollFault, payrollSuccess]),
    sleep: async () => {},
  });

  const result = await handler.submit(payload);
  assert.equal(result.receiptId, "PAY123");
});
