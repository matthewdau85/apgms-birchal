import { describe, expect, it } from "vitest";
import { nextBackoffMs } from "../src/index";

describe("nextBackoffMs", () => {
  it("grows exponentially", () => {
    expect(nextBackoffMs({ id: "job", attempts: 0 })).toBe(100);
    expect(nextBackoffMs({ id: "job", attempts: 3 })).toBe(800);
  });

  it("caps the delay", () => {
    expect(nextBackoffMs({ id: "job", attempts: 99 })).toBe(60_000);
  });
});
