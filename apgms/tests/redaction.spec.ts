import assert from "node:assert/strict";
import { createRedactedLogger, redactString, redactValue } from "../services/api-gateway/src/lib/redact";

type LogCall = { level: string; args: unknown[] };

function createStubLogger() {
  const calls: LogCall[] = [];
  const base = {
    info: (...args: unknown[]) => calls.push({ level: "info", args }),
    error: (...args: unknown[]) => calls.push({ level: "error", args }),
    warn: (...args: unknown[]) => calls.push({ level: "warn", args }),
    debug: (...args: unknown[]) => calls.push({ level: "debug", args }),
    trace: (...args: unknown[]) => calls.push({ level: "trace", args }),
    fatal: (...args: unknown[]) => calls.push({ level: "fatal", args }),
    child: () => base,
  };
  return { base: base as any, calls };
}

(function run() {
  const { base, calls } = createStubLogger();
  const logger = createRedactedLogger(base);

  const payload = {
    email: "user@example.com",
    token: "abc123secret",
    nested: {
      bsb: "123-456",
      accountNumber: "123456789",
      description: "Send to account 987654321",
    },
  };

  logger.info(payload, "User email user@example.com with token=abc123secret and BSB 123-456");

  assert.equal(calls.length, 1, "expected one log entry");
  const [call] = calls;
  const [objArg, messageArg] = call.args as [Record<string, unknown>, string];

  assert.equal(objArg.email, "[REDACTED_EMAIL]");
  assert.equal(objArg.token, "[REDACTED_TOKEN]");
  assert.equal((objArg.nested as any).bsb, "[REDACTED_BSB]");
  assert.equal((objArg.nested as any).accountNumber, "[REDACTED_ACCOUNT]");
  assert.equal(
    (objArg.nested as any).description,
    "Send to account [REDACTED_ACCOUNT]",
  );
  assert.equal(
    messageArg,
    "User email [REDACTED_EMAIL] with token: [REDACTED_TOKEN] and BSB [REDACTED_BSB]",
  );

  const text = "token=xyz987654321";
  assert.equal(redactString(text), "token: [REDACTED_TOKEN]");

  const structured = {
    bearerToken: "Bearer abcdefghijklmno",
    accId: 123456789,
  };
  const redactedStructured = redactValue(structured) as Record<string, unknown>;
  assert.equal(redactedStructured.bearerToken, "[REDACTED_TOKEN]");
  assert.equal(redactedStructured.accId, "[REDACTED_ACCOUNT]");
})();
