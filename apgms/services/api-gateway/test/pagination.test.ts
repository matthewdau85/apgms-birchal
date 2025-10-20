import { describe, expect, it } from "vitest";

import { normalizeTake } from "../src/lib/pagination.ts";

describe("normalizeTake", () => {
  it("uses the fallback when the input is not numeric", () => {
    expect(normalizeTake("not-a-number", 10)).toBe(10);
  });

  it("clamps the value to the allowed range", () => {
    expect(normalizeTake(0)).toBe(1);
    expect(normalizeTake(400)).toBe(200);
  });

  it("truncates non-integer numbers", () => {
    expect(normalizeTake(7.8)).toBe(7);
  });
});
