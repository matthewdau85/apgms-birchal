import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { WriteStream } from "node:fs";
import type { Writable } from "node:stream";

export type SecurityLogDetails = {
  decision: string;
  route: string;
  principal?: string | null;
  orgId?: string | null;
  ip?: string | null;
  reason?: string | null;
};

export type SecurityLogEntry = {
  ts: string;
  event: string;
  decision: string;
  route: string;
  principal?: string;
  orgId?: string;
  ip?: string;
  reason?: string;
};

let securityWriter: Writable | null = null;
let writerIsFileStream = false;

const toDefinedString = (value?: string | null): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = `${value}`.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const ensureSecurityWriter = (): Writable => {
  if (securityWriter) {
    return securityWriter;
  }

  const destination = process.env.SECURITY_LOG_PATH;
  if (destination && destination.trim().length > 0) {
    mkdirSync(dirname(destination), { recursive: true });
    const stream = createWriteStream(destination, { flags: "a" });
    securityWriter = stream;
    writerIsFileStream = true;
    return securityWriter;
  }

  securityWriter = process.stdout;
  writerIsFileStream = false;
  return securityWriter;
};

const closeCurrentWriter = () => {
  if (writerIsFileStream && securityWriter) {
    const closable = securityWriter as WriteStream;
    try {
      closable.end();
    } catch (err) {
      // best-effort close; ignore errors
    }
  }
  securityWriter = null;
  writerIsFileStream = false;
};

export const logSecurity = (event: string, details: SecurityLogDetails): void => {
  const entry: SecurityLogEntry = {
    ts: new Date().toISOString(),
    event,
    decision: details.decision,
    route: details.route,
  };

  const principal = toDefinedString(details.principal ?? undefined);
  const orgId = toDefinedString(details.orgId ?? undefined);
  const ip = toDefinedString(details.ip ?? undefined);
  const reason = toDefinedString(details.reason ?? undefined);

  if (principal) {
    entry.principal = principal;
  }
  if (orgId) {
    entry.orgId = orgId;
  }
  if (ip) {
    entry.ip = ip;
  }
  if (reason) {
    entry.reason = reason;
  }

  const writer = ensureSecurityWriter();
  writer.write(`${JSON.stringify(entry)}\n`);
};

/**
 * Internal helper for tests to override the destination stream.
 */
export const setSecurityLogWriter = (writer: Writable | null): void => {
  closeCurrentWriter();
  securityWriter = writer;
  writerIsFileStream = false;
};
