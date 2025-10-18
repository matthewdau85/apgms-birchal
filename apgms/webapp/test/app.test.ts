import assert from "node:assert/strict";
import test from "node:test";

test("webapp logs on startup", async () => {
  const original = console.log;
  const calls: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    await import("../src/main");
  } finally {
    console.log = original;
  }

  assert.ok(calls.some((args) => args.length === 1 && args[0] === "webapp"));
});
