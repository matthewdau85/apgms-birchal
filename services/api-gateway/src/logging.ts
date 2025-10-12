export const RESTRICTED_LOG_FIELDS = new Set([
  "body",
  "requestBody",
  "payload",
  "DATABASE_URL",
  "databaseUrl",
]);

export type LogMetadata = Record<string, unknown>;

export function filterRestrictedLogFields<T extends LogMetadata>(metadata: T): LogMetadata {
  const entries = Object.entries(metadata).filter(([key]) => !RESTRICTED_LOG_FIELDS.has(key));
  return Object.fromEntries(entries);
}
