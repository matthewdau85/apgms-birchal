import fs from "node:fs/promises";
import path from "node:path";

export interface ReceiptVerification {
  digestValue: string;
  matches: boolean;
}

const DIGEST_REGEX = /<DigestValue>([^<]+)<\/DigestValue>/i;

export function extractReceiptDigest(receiptXml: string): string {
  const match = receiptXml.match(DIGEST_REGEX);
  if (!match) {
    throw new Error("Receipt missing DigestValue");
  }
  return match[1].trim();
}

export function verifyNonRepudiation(receiptXml: string, expectedDigestHex: string): ReceiptVerification {
  const digestValue = extractReceiptDigest(receiptXml);
  return {
    digestValue,
    matches: digestValue === expectedDigestHex,
  };
}

export async function writeReceiptArtifacts(baseDir: string, receiptXml: string, verification: ReceiptVerification): Promise<void> {
  const receiptPath = path.join(baseDir, "receipt.xml");
  await fs.writeFile(receiptPath, receiptXml, "utf8");

  const verificationPath = path.join(baseDir, "receipt-verification.json");
  await fs.writeFile(
    verificationPath,
    JSON.stringify(
      {
        digestValue: verification.digestValue,
        matches: verification.matches,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}
