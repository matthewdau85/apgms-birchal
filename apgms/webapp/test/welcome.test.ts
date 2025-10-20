import { describe, expect, it } from "vitest";
import { welcomeMessage } from "../src/utils.js";

describe("welcomeMessage", () => {
  it("greets a named user", () => {
    expect(welcomeMessage("Birchal")).toBe("Welcome, Birchal!");
  });

  it("falls back to generic welcome", () => {
    expect(welcomeMessage("   ")).toBe("Welcome!");
  });
});
