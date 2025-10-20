/// <reference types="vitest/globals" />

import { buildServiceIdentifier } from "../src/index.ts";

describe("buildServiceIdentifier", () => {
  it("prefixes the provided service name", () => {
    expect(buildServiceIdentifier("api")).toBe("apgms:api");
  });
});
