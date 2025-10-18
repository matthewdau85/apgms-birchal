import { promises as fs } from 'node:fs';
import path from 'node:path';

type Artifact = {
  filename: string;
  content: string;
};

const evidenceDir = path.resolve(__dirname, '../../../../../evidence/as4');

const artifacts: Artifact[] = [
  {
    filename: 'request.json',
    content: JSON.stringify(
      {
        devStub: true,
        description: 'AS4 hello-world request placeholder',
        messageInfo: {
          messageId: 'urn:uuid:00000000-0000-0000-0000-000000000000',
          timestamp: '2025-01-01T00:00:00Z',
        },
        payload: {
          profile: 'hello-world',
          note: 'Populate with the real business document payload in production',
        },
      },
      null,
      2,
    ).concat('\n'),
  },
  {
    filename: 'receipt.json',
    content: JSON.stringify(
      {
        devStub: true,
        description: 'AS4 hello-world receipt placeholder',
        messageInfo: {
          refToMessageId: 'urn:uuid:00000000-0000-0000-0000-000000000000',
          timestamp: '2025-01-01T00:00:10Z',
        },
        receipt: {
          status: 'ACCEPTED',
          note: 'Replace with the signed receipt returned by the gateway',
        },
      },
      null,
      2,
    ).concat('\n'),
  },
  {
    filename: 'signature.xml',
    content: `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!-- Dev stub signature placeholder -->\n` +
      `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">\n` +
      `  <SignedInfo>\n` +
      `    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />\n` +
      `    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />\n` +
      `    <Reference URI="#as4-request">\n` +
      `      <Transforms>\n` +
      `        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />\n` +
      `      </Transforms>\n` +
      `      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />\n` +
      `      <DigestValue>REPLACE_WITH_REAL_DIGEST==</DigestValue>\n` +
      `    </Reference>\n` +
      `  </SignedInfo>\n` +
      `  <SignatureValue>REPLACE_WITH_REAL_SIGNATURE==</SignatureValue>\n` +
      `  <KeyInfo>\n` +
      `    <KeyName>DEV-STUB-KEY</KeyName>\n` +
      `  </KeyInfo>\n` +
      `</Signature>\n`,
  },
];

function isDevEnabled(): boolean {
  return process.env.SBR_AS4_DEV === '1';
}

async function persistArtifacts(): Promise<void> {
  if (!isDevEnabled()) {
    console.log('SBR_AS4_DEV is not set to 1; skipping AS4 stub generation.');
    return;
  }

  await fs.mkdir(evidenceDir, { recursive: true });

  await Promise.all(
    artifacts.map(async ({ filename, content }) => {
      const filePath = path.join(evidenceDir, filename);
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`Wrote ${filePath}`);
    }),
  );
}

persistArtifacts().catch((error) => {
  console.error('Failed to persist AS4 evidence stubs:', error);
  process.exitCode = 1;
});
