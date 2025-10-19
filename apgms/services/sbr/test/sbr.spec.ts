import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEnvelope } from "../src/as4/envelope";
import { signCanonicalUserMessage } from "../src/as4/sign";
import { verifyNonRepudiation } from "../src/as4/receipt";

describe("SBR AS4", () => {
  it("produces stable canonical digest", () => {
    const input = {
      orgId: "ORG123",
      docType: "DOC-TYPE",
      payload: "<Document>payload</Document>",
      messageId: "urn:uuid:fixed-message-id",
      timestamp: "2024-01-01T00:00:00.000Z",
    };

    const first = buildEnvelope(input);
    const second = buildEnvelope(input);

    assert.equal(first.userMessageCanonical, second.userMessageCanonical);

    const sigOne = signCanonicalUserMessage(first.userMessageCanonical);
    const sigTwo = signCanonicalUserMessage(second.userMessageCanonical);

    assert.equal(sigOne.digestHex, sigTwo.digestHex);
    assert.equal(sigOne.signatureBase64, sigTwo.signatureBase64);
  });

  it("accepts valid receipt for NRR", () => {
    const envelope = buildEnvelope({
      orgId: "ORG123",
      docType: "DOC-TYPE",
      payload: "<Document>payload</Document>",
      messageId: "urn:uuid:valid-receipt",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    const signature = signCanonicalUserMessage(envelope.userMessageCanonical);
    const receiptXml = `<Receipt><DigestValue>${signature.digestHex}</DigestValue></Receipt>`;

    const verification = verifyNonRepudiation(receiptXml, signature.digestHex);
    assert.equal(verification.matches, true);
    assert.equal(verification.digestValue, signature.digestHex);
  });

  it("rejects tampered receipt for NRR", () => {
    const envelope = buildEnvelope({
      orgId: "ORG123",
      docType: "DOC-TYPE",
      payload: "<Document>payload</Document>",
      messageId: "urn:uuid:tampered-receipt",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    const signature = signCanonicalUserMessage(envelope.userMessageCanonical);
    const tamperedDigest = signature.digestHex.replace(/.$/, (char) => (char === "a" ? "b" : "a"));
    const receiptXml = `<Receipt><DigestValue>${tamperedDigest}</DigestValue></Receipt>`;

    const verification = verifyNonRepudiation(receiptXml, signature.digestHex);
    assert.equal(verification.matches, false);
    assert.equal(verification.digestValue, tamperedDigest);
  });
});
