/// <reference types="vitest/globals" />

import { createHealthResponse } from "../src/health.ts";

describe("createHealthResponse", () => {
  it("returns the expected payload", () => {
    expect(createHealthResponse()).toEqual({ ok: true, service: "api-gateway" });
  });
});
