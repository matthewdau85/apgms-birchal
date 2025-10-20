import { describe, expect, it, vi } from "vitest";
import { getHealthStatus } from "../src/health.js";

describe("getHealthStatus", () => {
  it("returns a healthy payload", () => {
    const fakeNow = vi.fn(() => 1_700_000_000_000);
    const status = getHealthStatus("api-gateway", fakeNow);
    expect(status).toEqual({
      ok: true,
      service: "api-gateway",
      uptimeSeconds: expect.any(Number),
      checkedAt: 1_700_000_000_000,
    });
    expect(status.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("requires a service name", () => {
    expect(() => getHealthStatus("", () => Date.now())).toThrow(/service name/);
  });
});
