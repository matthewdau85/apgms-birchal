import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

type Org = { id: string; name: string };
type User = { email: string; password: string; orgId: string };
type BankLine = {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  desc: string;
};

type DbState = {
  orgs: Org[];
  users: User[];
  bankLines: BankLine[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const kmsDir = path.join(repoRoot, "artifacts", "kms");

function saveDb(filePath: string, state: DbState) {
  writeFileSync(filePath, JSON.stringify(state, null, 2));
}

function loadDb(filePath: string): DbState {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as DbState;
}

function createPgDumpStub(stubPath: string) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
OUT_FILE=""
DB_PATH=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --file)
      shift
      OUT_FILE="$1"
      ;;
    --format)
      shift
      ;;
    --clean|--if-exists|--no-owner)
      ;;
    *)
      DB_PATH="$1"
      ;;
  esac
  shift || true
done
if [ -z "$OUT_FILE" ] || [ -z "$DB_PATH" ]; then
  echo "pg_dump stub missing parameters" >&2
  exit 1
fi
cp "$DB_PATH" "$OUT_FILE"
`;
  writeFileSync(stubPath, script);
  chmodSync(stubPath, 0o755);
}

function createPsqlStub(stubPath: string) {
  const script = `#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -lt 1 ]; then
  echo "usage: psql <db-path> [-f dump]" >&2
  exit 1
fi
DB_PATH="$1"
shift || true
SQL_FILE=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -f)
      shift
      SQL_FILE="$1"
      ;;
  esac
  shift || true
done
if [ -z "$SQL_FILE" ]; then
  echo "psql stub requires -f" >&2
  exit 1
fi
cp "$SQL_FILE" "$DB_PATH"
`;
  writeFileSync(stubPath, script);
  chmodSync(stubPath, 0o755);
}

function verifyChainForRpt(rptId: string): boolean {
  const rptPath = path.join(kmsDir, "rpts", `${rptId}.json`);
  const serialized = readFileSync(rptPath, "utf-8");
  const parsed = JSON.parse(serialized) as {
    id: string;
    signer: string;
    payload: unknown;
    signature: string;
  };
  const signerPath = path.join(kmsDir, parsed.signer);
  const publicKey = crypto.createPublicKey(readFileSync(signerPath, "utf-8"));
  const payloadBuffer = Buffer.from(JSON.stringify(parsed.payload));
  const signatureBuffer = Buffer.from(parsed.signature, "base64");
  return crypto.verify(null, payloadBuffer, publicKey, signatureBuffer);
}

test("backup and restore retain seeded data and RPT signature chain", (t) => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "apgms-backup-test-"));
  t.after(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  rmSync(kmsDir, { recursive: true, force: true });
  mkdirSync(path.join(kmsDir, "rpts"), { recursive: true });
  t.after(() => {
    rmSync(kmsDir, { recursive: true, force: true });
  });

  const dbFile = path.join(tempRoot, "fake-db.json");
  const initialState: DbState = {
    orgs: [{ id: "demo-org", name: "Demo Org" }],
    users: [
      {
        email: "founder@example.com",
        password: "password123",
        orgId: "demo-org",
      },
    ],
    bankLines: [
      {
        id: crypto.randomUUID(),
        orgId: "demo-org",
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        amount: 1250.75,
        payee: "Acme",
        desc: "Office fit-out",
      },
      {
        id: crypto.randomUUID(),
        orgId: "demo-org",
        date: new Date(Date.now() - 86400000).toISOString(),
        amount: -299.99,
        payee: "CloudCo",
        desc: "Monthly sub",
      },
      {
        id: crypto.randomUUID(),
        orgId: "demo-org",
        date: new Date().toISOString(),
        amount: 5000.0,
        payee: "Birchal",
        desc: "Investment received",
      },
    ],
  };
  saveDb(dbFile, initialState);

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  writeFileSync(path.join(kmsDir, "master-public.pem"), publicKey.export({ type: "spki", format: "pem" }));
  writeFileSync(path.join(kmsDir, "master-private.pem"), privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600,
  });

  const payload = {
    orgId: initialState.orgs[0].id,
    issuedAt: new Date().toISOString(),
    checksum: crypto
      .createHash("sha256")
      .update(JSON.stringify(initialState.bankLines))
      .digest("hex"),
    total: initialState.bankLines
      .reduce((acc, line) => acc + line.amount, 0)
      .toFixed(2),
  };

  const rptId = crypto.randomUUID();
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString("base64");
  const rptPath = path.join(kmsDir, "rpts", `${rptId}.json`);
  writeFileSync(
    rptPath,
    JSON.stringify(
      {
        id: rptId,
        signer: "master-public.pem",
        payload,
        signature,
      },
      null,
      2
    )
  );

  assert.ok(verifyChainForRpt(rptId));

  const stubDir = path.join(tempRoot, "stubs");
  mkdirSync(stubDir, { recursive: true });
  const pgDumpStub = path.join(stubDir, "pg_dump");
  const psqlStub = path.join(stubDir, "psql");
  createPgDumpStub(pgDumpStub);
  createPsqlStub(psqlStub);

  const env = {
    ...process.env,
    DATABASE_URL: dbFile,
    PGDUMP_BIN: pgDumpStub,
    PSQL_BIN: psqlStub,
    BACKUP_DIR: tempRoot,
  };

  const backupOutput = execFileSync("bash", [path.join(repoRoot, "scripts", "backup.sh")], {
    cwd: repoRoot,
    env,
    encoding: "utf-8",
  });
  const backupPath = backupOutput.trim().split("\n").pop();
  assert.ok(backupPath && existsSync(backupPath), "backup archive should exist");

  t.after(() => {
    if (backupPath && existsSync(backupPath)) {
      rmSync(backupPath);
    }
  });

  saveDb(dbFile, { orgs: [], users: [], bankLines: [] });
  rmSync(kmsDir, { recursive: true, force: true });
  assert.ok(!existsSync(rptPath));

  execFileSync("bash", [path.join(repoRoot, "scripts", "restore.sh"), backupPath!], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });

  const restored = loadDb(dbFile);
  assert.deepEqual(restored, initialState);

  assert.ok(existsSync(rptPath), "RPT artifact restored");
  assert.ok(verifyChainForRpt(rptId), "signature must verify after restore");
});
