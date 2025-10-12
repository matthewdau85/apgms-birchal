import { createHash } from "node:crypto";

const DEFAULT_VISIBLE_LENGTH = 6;
const CHECKSUM_LENGTH = 6;

export function maskIdentifier(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  const normalized = value.toString();
  const visible = normalized.slice(0, DEFAULT_VISIBLE_LENGTH) || "unknown";
  const checksum = createHash("sha256").update(normalized).digest("hex").slice(0, CHECKSUM_LENGTH);

  return `${visible}#${checksum}`;
}
