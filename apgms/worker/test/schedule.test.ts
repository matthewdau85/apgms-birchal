import { describe, expect, it } from "vitest";

import { scheduleWindow } from "../src/index.ts";

describe("scheduleWindow", () => {
  it("creates a deterministic window based on the provided duration", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const result = scheduleWindow(start, 30);

    expect(result.start).toBe(start);
    expect(result.end.toISOString()).toBe("2024-01-01T00:30:00.000Z");
  });

  it("rejects non-positive durations", () => {
    expect(() => scheduleWindow(new Date(), 0)).toThrowError();
  });
});
