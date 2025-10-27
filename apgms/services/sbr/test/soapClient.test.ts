import assert from "node:assert/strict";
import test from "node:test";
import { SoapClient, SoapFaultError } from "../src/clients";

const successResponse = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SubmitBASResponse>
      <ReceiptNumber>12345</ReceiptNumber>
      <ProcessingStatus>ACCEPTED</ProcessingStatus>
      <LodgementTime>2024-06-01T00:00:00Z</LodgementTime>
    </SubmitBASResponse>
  </soap:Body>
</soap:Envelope>`;

const faultResponse = `<?xml version="1.0"?>
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

test("SoapClient builds envelopes with AUSkey authentication", () => {
  const client = new SoapClient({
    endpoint: "https://example.com",
    productId: "PID",
    credentials: {
      type: "auskey",
      abn: "12345678901",
      serialNumber: "SERIAL",
      keystoreId: "KEYSTORE",
    },
    transport: async () => ({ status: 200, headers: {}, body: successResponse }),
  });

  const envelope = client.createEnvelope("<Test>ok</Test>");
  assert.ok(envelope.includes("<aus:ABN>12345678901</aus:ABN>"));
  assert.ok(envelope.includes("<aus:SerialNumber>SERIAL</aus:SerialNumber>"));
  assert.ok(envelope.includes("<aus:KeystoreID>KEYSTORE</aus:KeystoreID>"));
  assert.ok(envelope.includes("<Test>ok</Test>"));
});

test("SoapClient parses SOAP responses", async () => {
  const client = new SoapClient({
    endpoint: "https://example.com",
    productId: "PID",
    credentials: {
      type: "mygovid",
      abn: "12345678901",
      deviceId: "device",
      authToken: "token",
    },
    transport: async () => ({ status: 200, headers: {}, body: successResponse }),
  });

  const body = await client.send("SubmitBAS", "<SubmitBASRequest />");
  assert.ok(body.SubmitBASResponse);
});

test("SoapClient throws on SOAP faults", async () => {
  const client = new SoapClient({
    endpoint: "https://example.com",
    productId: "PID",
    credentials: {
      type: "mygovid",
      abn: "12345678901",
      deviceId: "device",
      authToken: "token",
    },
    transport: async () => ({ status: 500, headers: {}, body: faultResponse }),
  });

  await assert.rejects(() => client.send("SubmitBAS", "<SubmitBASRequest />"), SoapFaultError);
});
