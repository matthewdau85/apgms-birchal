/// <reference types="vitest/globals" />

import { formatWorkerJob } from "../src/index.ts";

describe("formatWorkerJob", () => {
  it("returns a worker-prefixed job name", () => {
    expect(formatWorkerJob("email")).toBe("worker:email");
  });
});
