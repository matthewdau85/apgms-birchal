export interface AuditLogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  userId?: string;
  orgId?: string;
}

type NullableString = string | null | undefined;

const PII_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, replacement: "[redacted-email]" },
  { regex: /\b\d{9,}\b/g, replacement: "[redacted-number]" },
];

const redactString = (value: NullableString): string | undefined => {
  if (value == null) {
    return undefined;
  }

  return PII_PATTERNS.reduce((current, pattern) => current.replace(pattern.regex, pattern.replacement), value);
};

const sanitizePath = (rawPath: string): string => {
  const [path] = rawPath.split("?");
  return redactString(path) ?? path;
};

export const audit = (
  method: string,
  path: string,
  userId: NullableString,
  orgId: NullableString,
  status: number,
): AuditLogEntry => {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    method: method.toUpperCase(),
    path: sanitizePath(path),
    status,
  };

  const redactedUser = redactString(userId);
  if (redactedUser) {
    entry.userId = redactedUser;
  }

  const redactedOrg = redactString(orgId);
  if (redactedOrg) {
    entry.orgId = redactedOrg;
  }

  return entry;
};
