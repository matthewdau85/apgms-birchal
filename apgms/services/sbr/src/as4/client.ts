import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
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

const BASE_DIR = path.resolve(process.cwd(), "var", "as4");

const REQUEST_FILENAME = "request.xml";
const RECEIPT_FILENAME = "receipt.xml";
const SIGNATURES_FILENAME = "signatures.json";

export async function send(
  payload: unknown,
  { action, orgId }: SendOptions,
): Promise<SendResult> {
  if (!action || !orgId) {
    throw new Error("action and orgId are required");
  }

  await fs.mkdir(BASE_DIR, { recursive: true });

  const input = JSON.stringify({ payload, action, orgId });
  const hash = createHash("sha256").update(input).digest("hex");
  const messageId = `DEV-${hash.slice(0, 12)}`;
  const receiptId = `DEV-R-${hash.slice(12, 24)}`;
  const sentAt = new Date().toISOString();

  const messageDir = path.join(BASE_DIR, messageId);
  await fs.mkdir(messageDir, { recursive: true });

  const requestXml = buildRequestXml({
    action,
    orgId,
    messageId,
    sentAt,
    payload,
  });
  const receiptXml = buildReceiptXml({
    messageId,
    receiptId,
    sentAt,
  });
  const signatures = buildSignatures({
    messageId,
    receiptId,
    hash,
  });

  await Promise.all([
    fs.writeFile(path.join(messageDir, REQUEST_FILENAME), requestXml, "utf8"),
    fs.writeFile(path.join(messageDir, RECEIPT_FILENAME), receiptXml, "utf8"),
    fs.writeFile(
      path.join(messageDir, SIGNATURES_FILENAME),
      JSON.stringify(signatures, null, 2),
      "utf8",
    ),
  ]);

  return { messageId, sentAt, receiptId };
}

function buildRequestXml(args: {
  action: string;
  orgId: string;
  messageId: string;
  sentAt: string;
  payload: unknown;
}): string {
  const payloadText =
    typeof args.payload === "string"
      ? args.payload
      : JSON.stringify(args.payload ?? null, null, 2);

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<AS4Request>",
    `  <MessageId>${args.messageId}</MessageId>`,
    `  <Action>${escapeXml(args.action)}</Action>`,
    `  <OrgId>${escapeXml(args.orgId)}</OrgId>`,
    `  <SentAt>${args.sentAt}</SentAt>`,
    "  <Payload><![CDATA[",
    payloadText,
    "]]></Payload>",
    "</AS4Request>",
    "",
  ].join("\n");
}

function buildReceiptXml(args: {
  messageId: string;
  receiptId: string;
  sentAt: string;
}): string {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<AS4Receipt>",
    `  <ReceiptId>${args.receiptId}</ReceiptId>`,
    `  <MessageId>${args.messageId}</MessageId>`,
    `  <ReceivedAt>${args.sentAt}</ReceivedAt>`,
    "</AS4Receipt>",
    "",
  ].join("\n");
}

function buildSignatures(args: {
  messageId: string;
  receiptId: string;
  hash: string;
}) {
  return {
    messageId: args.messageId,
    receiptId: args.receiptId,
    algorithm: "SHA-256",
    checksum: args.hash,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const filenames = {
  request: REQUEST_FILENAME,
  receipt: RECEIPT_FILENAME,
  signatures: SIGNATURES_FILENAME,
};

export const paths = {
  base: BASE_DIR,
};
