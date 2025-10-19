import test from "node:test";
import assert from "node:assert/strict";
import { createAppLogger, redactString, redactValue } from "../services/api-gateway/src/lib/log";

test("redactString masks PII patterns", () => {
  const input = "user alice@example.com token=abcdef123456 BSB 123-456 acc=123456789";
  const output = redactString(input);

  assert.ok(output.includes("***@example.com"));
  assert.ok(!output.includes("alice@example.com"));
  assert.ok(output.includes("***-***"));
  assert.ok(!output.includes("123-456"));
  assert.ok(output.includes("token=***REDACTED***"));
  assert.ok(!output.includes("abcdef123456"));
  assert.ok(output.includes("acc=***89"));
});

test("redactValue walks objects recursively", () => {
  const result = redactValue({
    user: { email: "bob@example.com" },
    accounts: ["acct=987654321"],
  });

  assert.deepEqual(result, {
    user: { email: "***@example.com" },
    accounts: ["acct=***21"],
  });
});

test("logger output redacts structured payloads", () => {
  const lines: Array<unknown[]> = [];
  const baseLogger = {
    info: (...args: unknown[]) => {
      lines.push(args);
    },
    child: () => baseLogger,
  };

  const logger = createAppLogger(baseLogger);
  logger.info({ email: "carol@example.com", details: "BSB 999-111" }, "Authorization: Bearer abcdefghijk");

  assert.equal(lines.length, 1);
  const [payload, message] = lines[0];
  assert.deepEqual(payload, { email: "***@example.com", details: "BSB ***-***" });
  assert.equal(message, "Authorization: Bearer ***REDACTED***");
});
