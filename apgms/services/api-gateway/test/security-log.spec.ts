import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  logMissingToken,
  logReplayRejection,
  logRoleMismatch,
  resetSecurityLogWriter,
  setSecurityLogWriter,
  type SecurityLogEntry,
} from "../src/security/logging";

type SnapshotMap = Record<string, unknown>;

type TestCase = {
  name: string;
  fn: () => void;
};

const cases: TestCase[] = [];

function test(name: string, fn: () => void) {
  cases.push({ name, fn });
}

const snapshotPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__snapshots__",
  "security-log.snap.json",
);

const snapshots = JSON.parse(
  fs.readFileSync(snapshotPath, "utf-8"),
) as SnapshotMap;

function captureLog(action: () => void) {
  const entries: SecurityLogEntry[] = [];
  setSecurityLogWriter((entry) => {
    entries.push(JSON.parse(JSON.stringify(entry)) as SecurityLogEntry);
  });
  try {
    action();
  } finally {
    resetSecurityLogWriter();
  }
  return entries;
}

test("records 401 denial when token missing", () => {
  const entries = captureLog(() => {
    logMissingToken({ route: "/v1/secure/documents" });
  });

  assert.equal(entries.length, 1);
  const entry = entries[0]!;

  assert.ok(entry.event, "event field present");
  assert.ok(entry.decision, "decision field present");
  assert.ok(entry.route, "route field present");
  assert.ok(entry.reason, "reason field present");
  assert.equal(entry.orgId, undefined);
  assert.equal(entry.principal, undefined);

  assert.deepStrictEqual(entry, snapshots["missing-token-401"]);
});

test("records 403 denial for role mismatch", () => {
  const entries = captureLog(() => {
    logRoleMismatch({
      route: "/v1/admin/reports",
      orgId: "org_456",
      principalId: "user_123",
      principalRoles: ["viewer"],
      requiredRoles: ["admin"],
    });
  });

  assert.equal(entries.length, 1);
  const entry = entries[0]!;

  assert.ok(entry.event, "event field present");
  assert.ok(entry.decision, "decision field present");
  assert.ok(entry.route, "route field present");
  assert.ok(entry.reason, "reason field present");
  assert.equal(typeof entry.orgId, "string");
  assert.equal(typeof entry.principal, "object");

  assert.deepStrictEqual(entry, snapshots["role-mismatch-403"]);
});

test("records replay rejection when body hashes differ", () => {
  const entries = captureLog(() => {
    logReplayRejection({
      route: "/v1/secure/documents",
      principalId: "user_321",
      orgId: "org_654",
      expectedBodyHash: "sha256:expected",
      receivedBodyHash: "sha256:received",
    });
  });

  assert.equal(entries.length, 1);
  const entry = entries[0]!;

  assert.ok(entry.event, "event field present");
  assert.ok(entry.decision, "decision field present");
  assert.ok(entry.route, "route field present");
  assert.ok(entry.reason, "reason field present");
  assert.equal(typeof entry.orgId, "string");
  assert.equal(typeof entry.principal, "object");

  assert.deepStrictEqual(entry, snapshots["replay-reject"]);
});

function run() {
  let failed = 0;
  for (const { name, fn } of cases) {
    try {
      fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`✗ ${name}`);
      if (error instanceof Error) {
        console.error(error.stack ?? error.message);
      } else {
        console.error(error);
      }
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

run();
