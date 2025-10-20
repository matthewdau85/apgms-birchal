import { describe, expect, it } from "vitest";
import { asNonEmptyString, formatAudCurrency } from "../src/index.js";

describe("shared helpers", () => {
  it("formats AUD currency in en-AU locale", () => {
    expect(formatAudCurrency(1234.56)).toBe("$1,234.56");
  });

  it("brands non-empty strings", () => {
    const result = asNonEmptyString("Birchal");
    expect(result).toEqual("Birchal");
  });

  it("rejects empty strings", () => {
    expect(() => asNonEmptyString(" ")).toThrowError(/non-empty/);
  });
});
