import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const sanitizeTimestamp = (value: Date): string => value.toISOString().replace(/[:.]/g, '-');

async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function buildRequest(messageId: string, createdAt: string) {
  return {
    messageId,
    createdAt,
    direction: 'outbound',
    partnershipId: 'sbr-as4-stub',
    payload: {
      documentType: 'AS4TestPayload',
      checksum: Buffer.from(messageId).toString('base64url'),
      note: 'This is a placeholder AS4 request for compliance evidence.',
    },
  };
}

function buildReceipt(messageId: string, createdAt: string) {
  return {
    relatesTo: messageId,
    createdAt,
    receiptType: 'as4-mock-receipt',
    status: 'accepted',
    details: 'Stub receipt confirming message acceptance for compliance purposes.',
  };
}

async function writeArtifacts(targetDir: string, messageId: string, createdAt: string): Promise<void> {
  const request = buildRequest(messageId, createdAt);
  const receipt = buildReceipt(messageId, createdAt);
  const signature = `Message-ID: ${messageId}\nCreated-At: ${createdAt}\nSignature: ***stub-signature***`;

  await ensureDirectory(targetDir);
  await Promise.all([
    fs.writeFile(path.join(targetDir, 'request.json'), `${JSON.stringify(request, null, 2)}\n`, 'utf-8'),
    fs.writeFile(path.join(targetDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf-8'),
    fs.writeFile(path.join(targetDir, 'signature.txt'), `${signature}\n`, 'utf-8'),
  ]);
}

async function run(): Promise<void> {
  const now = new Date();
  const timestamp = sanitizeTimestamp(now);
  const createdAt = now.toISOString();
  const messageId = `urn:uuid:${randomUUID()}`;
  const projectRoot = path.resolve(__dirname, '../../..');
  const evidenceDir = path.join(projectRoot, 'evidence', 'as4', timestamp);

  await writeArtifacts(evidenceDir, messageId, createdAt);

  // eslint-disable-next-line no-console
  console.log(`AS4 stub evidence written to ${path.relative(projectRoot, evidenceDir)}`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
