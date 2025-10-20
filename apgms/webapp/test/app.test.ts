/// <reference types="vitest/globals" />

import { createGreeting } from "../src/app.ts";

describe("createGreeting", () => {
  it("greets the provided name", () => {
    expect(createGreeting("visitor")).toBe("Welcome, visitor!");
  });
});
