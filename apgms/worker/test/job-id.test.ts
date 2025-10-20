import { describe, expect, it } from "vitest";
import { buildJobId } from "../src/index.js";

describe("buildJobId", () => {
  it("concatenates queue and id", () => {
    expect(buildJobId("email", 42)).toBe("email::42");
  });

  it("validates queue name", () => {
    expect(() => buildJobId("", 1)).toThrow(/queue/);
  });

  it("validates id", () => {
    expect(() => buildJobId("email", -1)).toThrow(/non-negative/);
  });
});
