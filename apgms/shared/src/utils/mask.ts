import { createHash } from "node:crypto";

const DEFAULT_VISIBLE_LENGTH = 6;
const CHECKSUM_LENGTH = 6;

/**
 * Masks a potentially sensitive identifier by only keeping the first few
 * characters visible and appending a deterministic checksum. This ensures we
 * can correlate logs without leaking the full value.
 */
export function maskIdentifier(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  const normalized = value.toString();
  const visible = normalized.slice(0, DEFAULT_VISIBLE_LENGTH) || "unknown";
  const checksum = createHash("sha256").update(normalized).digest("hex").slice(0, CHECKSUM_LENGTH);

  return `${visible}#${checksum}`;
}
