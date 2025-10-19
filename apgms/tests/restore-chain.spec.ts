import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { rotateKey } from "../services/api-gateway/src/lib/kms";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const artifactsDir = path.join(repoRoot, "artifacts");
const kmsDir = path.join(artifactsDir, "kms");
const backupDir = path.join(artifactsDir, "backup");
const dbBackupFile = path.join(backupDir, "db", "dump.sql");
const kmsArchive = path.join(backupDir, "kms.tar.gz");
const stubDbFile = path.join(artifactsDir, "stub-db.json");
const stubBinDir = path.join(__dirname, ".stub-bin");

interface RptRecord {
  id: string;
  prevId: string | null;
  payload: string;
  createdAt: string;
  hash: string;
}

interface StubDb {
  headId: string | null;
  records: Record<string, RptRecord>;
}

async function ensureCleanArtifacts() {
  await fs.rm(artifactsDir, { recursive: true, force: true });
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.mkdir(kmsDir, { recursive: true });
  const initial: StubDb = { headId: null, records: {} };
  await fs.writeFile(stubDbFile, JSON.stringify(initial, null, 2), "utf8");
}

async function loadDb(): Promise<StubDb> {
  const raw = await fs.readFile(stubDbFile, "utf8");
  return JSON.parse(raw) as StubDb;
}

async function saveDb(db: StubDb) {
  await fs.writeFile(stubDbFile, JSON.stringify(db, null, 2), "utf8");
}

async function mintRpt(payload: string): Promise<string> {
  const db = await loadDb();
  const createdAt = new Date().toISOString();
  const prevId = db.headId;
  const prevHash = prevId ? db.records[prevId]?.hash ?? "" : "";
  const id = randomUUID();
  const hash = createHash("sha256")
    .update([prevHash, payload, createdAt].join("|"))
    .digest("hex");

  const record: RptRecord = { id, prevId, payload, createdAt, hash };
  db.records[id] = record;
  db.headId = id;
  await saveDb(db);
  return id;
}

async function getHeadId(): Promise<string | null> {
  const db = await loadDb();
  return db.headId;
}

async function verifyChain(headId: string | null): Promise<boolean> {
  if (!headId) {
    return false;
  }

  const db = await loadDb();
  const visited = new Set<string>();
  let currentId: string | null = headId;

  while (currentId) {
    if (visited.has(currentId)) {
      return false;
    }

    visited.add(currentId);
    const current = db.records[currentId];

    if (!current) {
      return false;
    }

    const prevHash = current.prevId ? db.records[current.prevId]?.hash ?? "" : "";
    const expectedHash = createHash("sha256")
      .update([prevHash, current.payload, current.createdAt].join("|"))
      .digest("hex");

    if (expectedHash !== current.hash) {
      return false;
    }

    currentId = current.prevId;
  }

  return true;
}

async function setupStubBinaries() {
  await fs.rm(stubBinDir, { recursive: true, force: true });
  await fs.mkdir(stubBinDir, { recursive: true });

  const pgDumpScript = "#!/usr/bin/env bash\nset -euo pipefail\ncat \"$STUB_DB_FILE\"\n";
  const psqlScript = "#!/usr/bin/env bash\nset -euo pipefail\ncat > \"$STUB_DB_FILE\"\n";

  await fs.writeFile(path.join(stubBinDir, "pg_dump"), pgDumpScript, { mode: 0o755 });
  await fs.writeFile(path.join(stubBinDir, "psql"), psqlScript, { mode: 0o755 });
}

test("backup and restore drill preserves the RPT chain", async () => {
  await ensureCleanArtifacts();
  await setupStubBinaries();

  const env = {
    ...process.env,
    DATABASE_URL: "postgres://stub",
    STUB_DB_FILE: stubDbFile,
    PATH: `${stubBinDir}${path.delimiter}${process.env.PATH ?? ""}`,
  };

  await rotateKey("rpt-signing");
  await rotateKey("rpt-audit");

  await mintRpt("alpha");
  await mintRpt("beta");
  const headBefore = await mintRpt("gamma");

  assert.equal(await verifyChain(headBefore), true, "pre-backup chain validation failed");

  execFileSync("bash", [path.join(repoRoot, "scripts", "backup-db.sh")], {
    cwd: repoRoot,
    env,
  });

  execFileSync("bash", [path.join(repoRoot, "scripts", "backup-kms.sh")], {
    cwd: repoRoot,
    env,
  });

  await saveDb({ headId: null, records: {} });
  await fs.rm(kmsDir, { recursive: true, force: true });
  await fs.mkdir(kmsDir, { recursive: true });

  execFileSync("bash", [path.join(repoRoot, "scripts", "restore-db.sh")], {
    cwd: repoRoot,
    env,
  });

  execFileSync("bash", [path.join(repoRoot, "scripts", "restore-kms.sh")], {
    cwd: repoRoot,
    env,
  });

  const headAfter = await getHeadId();

  assert.equal(headAfter, headBefore, "head pointer changed after restore");
  assert.equal(await verifyChain(headAfter), true, "restored chain validation failed");

  const restoredKmsEntries = await fs.readdir(kmsDir);
  assert.ok(restoredKmsEntries.length > 0, "KMS artifacts not restored");

  const dbBackupExists = await fs.access(dbBackupFile).then(() => true).catch(() => false);
  const kmsBackupExists = await fs.access(kmsArchive).then(() => true).catch(() => false);

  assert.equal(dbBackupExists, true, "database backup file missing");
  assert.equal(kmsBackupExists, true, "kms backup archive missing");
});
