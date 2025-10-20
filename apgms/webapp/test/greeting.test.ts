import { describe, expect, it } from "vitest";
import { createWelcomeMessage } from "../src/greeting";

describe("createWelcomeMessage", () => {
  it("prefixes the welcome string", () => {
    expect(createWelcomeMessage("Birchal")).toBe("Welcome to Birchal!");
  });
});
