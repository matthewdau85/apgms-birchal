import { generateKeyPairSync, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = path.resolve(__dirname, "..", "..", "artifacts", "kms");

export interface KmsKeyArtifact {
  id: string;
  createdAt: string;
  publicKey: string;
  secretKey: string;
}

async function ensureArtifactsDir(): Promise<void> {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

async function loadArtifact(file: string): Promise<KmsKeyArtifact | null> {
  try {
    const raw = await fs.readFile(path.join(ARTIFACTS_DIR, file), "utf8");
    const parsed = JSON.parse(raw) as KmsKeyArtifact;
    if (!parsed?.id || !parsed?.publicKey || !parsed?.secretKey) {
      return null;
    }
    return parsed;
  } catch (error: unknown) {
    return null;
  }
}

export async function listKeys(): Promise<KmsKeyArtifact[]> {
  await ensureArtifactsDir();
  const files = await fs.readdir(ARTIFACTS_DIR);
  const artifacts: KmsKeyArtifact[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const artifact = await loadArtifact(file);
    if (artifact) {
      artifacts.push(artifact);
    }
  }
  return artifacts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getKey(id: string): Promise<KmsKeyArtifact | null> {
  await ensureArtifactsDir();
  try {
    const artifact = await loadArtifact(`${id}.json`);
    return artifact;
  } catch (error: unknown) {
    return null;
  }
}

export async function getActiveKey(): Promise<KmsKeyArtifact> {
  const artifacts = await listKeys();
  if (artifacts.length > 0) {
    return artifacts[0];
  }
  return rotateKey();
}

export async function rotateKey(): Promise<KmsKeyArtifact> {
  await ensureArtifactsDir();
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const artifact: KmsKeyArtifact = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    secretKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  };
  await fs.writeFile(
    path.join(ARTIFACTS_DIR, `${artifact.id}.json`),
    JSON.stringify(artifact, null, 2),
    "utf8",
  );
  return artifact;
}
