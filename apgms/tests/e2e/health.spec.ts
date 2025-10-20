import { expect, test } from "@playwright/test";

const ENDPOINTS = ["/health", "/ready"] as const;

test.describe("health and readiness", () => {
  for (const endpoint of ENDPOINTS) {
    test(`${endpoint} responds successfully`, async ({ request }) => {
      const response = await request.get(endpoint);
      expect(response.ok(), `Expected ${endpoint} to return 2xx, got ${response.status()}`).toBeTruthy();

      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        if (payload && typeof payload === "object" && "ok" in payload) {
          expect((payload as { ok: unknown }).ok).toBe(true);
        }
      }
    });
  }
});
