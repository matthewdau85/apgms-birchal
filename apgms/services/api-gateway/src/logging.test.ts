import assert from "node:assert/strict";
import test from "node:test";

import { filterRestrictedLogFields, RESTRICTED_LOG_FIELDS } from "./logging";
import { maskIdentifier } from "../../../shared/src/utils/mask";

test("filterRestrictedLogFields removes restricted keys", () => {
  const metadata = {
    route: "/bank-lines",
    body: { secret: "value" },
    DATABASE_URL: "postgres://very-secret",
    resultCount: 2,
  };

  const sanitized = filterRestrictedLogFields(metadata);

  for (const key of RESTRICTED_LOG_FIELDS) {
    assert.ok(!(key in sanitized), `expected ${key} to be removed`);
  }

  assert.deepStrictEqual(sanitized, {
    route: "/bank-lines",
    resultCount: 2,
  });
});

test("maskIdentifier keeps only the prefix and checksum", () => {
  const masked = maskIdentifier("sensitive-org-identifier");

  assert.match(masked, /^[^#]+#[0-9a-f]{6}$/);
  assert.ok(!masked.includes("sensitive-org-identifier"), "original value should not appear");
});
