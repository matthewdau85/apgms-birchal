import { describe, expect, it } from "vitest";
import { resolvePort } from "../src/config";

describe("resolvePort", () => {
  it("parses a valid port", () => {
    expect(resolvePort("8080")).toBe(8080);
  });

  it("falls back to the default for invalid values", () => {
    expect(resolvePort("not-a-number")).toBe(3000);
  });
});
