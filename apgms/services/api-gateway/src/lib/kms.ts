import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface RotationRecord {
  alias: string;
  rotatedAt: string;
  version: number;
  materialChecksum: string;
}

const artifactsRoot = path.resolve(process.cwd(), "artifacts", "kms");

async function ensureArtifactsDir() {
  await fs.mkdir(artifactsRoot, { recursive: true });
}

function timestampLabel(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function rotateKey(alias: string): Promise<RotationRecord> {
  if (!alias) {
    throw new Error("alias is required for key rotation");
  }

  await ensureArtifactsDir();

  const now = new Date();
  const rotationLabel = timestampLabel(now);
  const filename = `${alias}-${rotationLabel}.json`;
  const filePath = path.join(artifactsRoot, filename);

  const existingEntries = await fs
    .readdir(artifactsRoot)
    .then((entries) => entries.filter((entry) => entry.startsWith(`${alias}-`)))
    .catch(() => [] as string[]);

  const version = existingEntries.length + 1;
  const material = randomBytes(32).toString("hex");
  const materialChecksum = createHash("sha256").update(material).digest("hex");

  const record: RotationRecord = {
    alias,
    rotatedAt: now.toISOString(),
    version,
    materialChecksum,
  };

  const payload = {
    ...record,
    material,
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return record;
}
