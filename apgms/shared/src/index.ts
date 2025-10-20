export interface AccountIdParts {
  orgId: string;
  suffix: number;
}

export function formatAccountId({ orgId, suffix }: AccountIdParts): string {
  if (!orgId || suffix < 0) {
    throw new Error("Invalid account id parts");
  }

  return `${orgId}-${suffix.toString().padStart(4, "0")}`;
}
