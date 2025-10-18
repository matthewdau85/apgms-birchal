export const toDecimalString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "0";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return value.toFixed(2);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return (value as { toString(): string }).toString();
  }

  return String(value);
};

export const toIsoString = (value: Date): string => value.toISOString();
