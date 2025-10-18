import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { logSecurity, setSecurityLogWriter } from "../src/lib/seclog";

class MemoryWritable extends Writable {
  public chunks: string[] = [];

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk.toString());
    callback();
  }

  toString(): string {
    return this.chunks.join("");
  }
}

const snapshotPath = resolve(dirname(fileURLToPath(import.meta.url)), "__snapshots__", "seclog.snap.json");

const run = async () => {
  const sink = new MemoryWritable();
  setSecurityLogWriter(sink);

  logSecurity("auth_failure", {
    decision: "deny",
    route: "/bank-lines",
    principal: "user-123",
    orgId: "org-456",
    ip: "203.0.113.42",
    reason: "missing_authorization_header",
  });

  await new Promise((resolveImmediate) => setImmediate(resolveImmediate));

  const raw = sink.toString().trim();
  const parsed = JSON.parse(raw);
  const normalized = { ...parsed, ts: "<ts>" };

  const expected = JSON.parse(readFileSync(snapshotPath, "utf8"));
  assert.deepStrictEqual(normalized, expected);

  setSecurityLogWriter(null);
  console.log("✓ logSecurity snapshot matches");
};

await run();
