import { describe, expect, it } from "vitest";
import { formatAccountId } from "../src/index";

describe("formatAccountId", () => {
  it("pads the numeric suffix", () => {
    expect(formatAccountId({ orgId: "org", suffix: 7 })).toBe("org-0007");
  });

  it("throws for invalid parts", () => {
    expect(() => formatAccountId({ orgId: "", suffix: 1 })).toThrowError(
      /invalid account id/i,
    );
  });
});
