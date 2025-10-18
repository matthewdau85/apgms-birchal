import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SendOptions {
  action: string;
  orgId: string;
}

export interface SendResult {
  messageId: string;
  sentAt: string;
  receiptId: string;
}

const AS4_BASE_DIR = path.resolve(process.cwd(), "var", "as4");

export async function send(
  payload: string | Buffer,
  options: SendOptions,
): Promise<SendResult> {
  const messageId = randomUUID();
  const receiptId = randomUUID();
  const sentAt = new Date().toISOString();

  const payloadText =
    typeof payload === "string" ? payload : payload.toString("utf-8");

  const messageDir = path.join(AS4_BASE_DIR, messageId);

  await mkdir(messageDir, { recursive: true });

  const requestPath = path.join(messageDir, "request.xml");
  const receiptPath = path.join(messageDir, "receipt.xml");
  const signaturesPath = path.join(messageDir, "signatures.json");

  const receiptXml = buildReceiptXml({
    messageId,
    receiptId,
    sentAt,
    action: options.action,
    orgId: options.orgId,
  });

  const signatures = buildSignaturesArtifact(payloadText, receiptXml, sentAt);

  await Promise.all([
    writeFile(requestPath, payloadText, "utf-8"),
    writeFile(receiptPath, receiptXml, "utf-8"),
    writeFile(signaturesPath, JSON.stringify(signatures, null, 2), "utf-8"),
  ]);

  return { messageId, receiptId, sentAt };
}

function buildReceiptXml(params: {
  messageId: string;
  receiptId: string;
  sentAt: string;
  action: string;
  orgId: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Receipt>\n` +
    `  <MessageId>${params.messageId}</MessageId>\n` +
    `  <ReceiptId>${params.receiptId}</ReceiptId>\n` +
    `  <OrgId>${params.orgId}</OrgId>\n` +
    `  <Action>${params.action}</Action>\n` +
    `  <SentAt>${params.sentAt}</SentAt>\n` +
    `</Receipt>\n`;
}

function buildSignaturesArtifact(
  requestXml: string,
  receiptXml: string,
  sentAt: string,
) {
  return [
    {
      algorithm: "SHA256",
      signedAt: sentAt,
      requestDigest: createHash("sha256").update(requestXml).digest("hex"),
      receiptDigest: createHash("sha256").update(receiptXml).digest("hex"),
    },
  ];
}
