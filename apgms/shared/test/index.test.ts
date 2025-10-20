import { describe, expect, it } from "vitest";

import { formatServiceTag } from "../src/index.ts";

describe("formatServiceTag", () => {
  it("namespaces the provided service", () => {
    expect(formatServiceTag("shared")).toBe("apgms:shared");
  });
});
