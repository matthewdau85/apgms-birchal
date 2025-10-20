export const formatAudCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);

export type NonEmptyString = string & { __brand: "NonEmptyString" };

export const asNonEmptyString = (value: string): NonEmptyString => {
  if (value.trim().length === 0) {
    throw new Error("value must be non-empty");
  }
  return value as NonEmptyString;
};

export { prisma } from "./db.js";
