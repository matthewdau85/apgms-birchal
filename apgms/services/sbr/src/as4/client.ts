import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactsRoot = path.resolve(__dirname, "../../../../var/as4");

export interface SendOptions {
  action: string;
  orgId: string;
}

export interface SendResult {
  messageId: string;
  sentAt: string;
  receiptId: string;
}

const buildReceiptXml = (details: {
  messageId: string;
  receiptId: string;
  orgId: string;
  action: string;
  sentAt: string;
}) => `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<receipt>` +
  `<messageId>${details.messageId}</messageId>` +
  `<receiptId>${details.receiptId}</receiptId>` +
  `<orgId>${details.orgId}</orgId>` +
  `<action>${details.action}</action>` +
  `<sentAt>${details.sentAt}</sentAt>` +
  `</receipt>\n`;

export const send = async (
  payload: string | Buffer,
  { action, orgId }: SendOptions,
): Promise<SendResult> => {
  const messageId = randomUUID();
  const receiptId = randomUUID();
  const sentAt = new Date().toISOString();

  const messageDir = path.join(artifactsRoot, messageId);
  await fs.mkdir(messageDir, { recursive: true });

  const payloadContent = typeof payload === "string" ? payload : payload.toString("utf-8");
  await fs.writeFile(path.join(messageDir, "request.xml"), payloadContent, "utf-8");

  const receiptXml = buildReceiptXml({ messageId, receiptId, orgId, action, sentAt });
  await fs.writeFile(path.join(messageDir, "receipt.xml"), receiptXml, "utf-8");

  const signatures = {
    messageId,
    receiptId,
    sentAt,
    action,
    orgId,
    stub: true,
  };

  await fs.writeFile(
    path.join(messageDir, "signatures.json"),
    JSON.stringify(signatures, null, 2),
    "utf-8",
  );

  return { messageId, sentAt, receiptId };
};
