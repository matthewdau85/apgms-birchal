import { describe, expect, it } from "vitest";

import { renderGreeting } from "../src/main.tsx";

describe("renderGreeting", () => {
  it("personalises the welcome message", () => {
    expect(renderGreeting("team")).toBe("Welcome to APGMS, team!");
  });
});
