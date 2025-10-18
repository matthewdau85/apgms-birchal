import { describe, expect, test } from "../../scripts/testing";
import { formatCurrency, sum } from "../src";

describe("currency helpers", () => {
  test("formats currency using Australian locale by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  test("sums values safely", () => {
    expect(sum([1, 2, 3.5])).toBeCloseTo(6.5);
  });
});
