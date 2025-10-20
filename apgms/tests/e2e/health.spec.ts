import { test, expect } from "@playwright/test";

const includeReadyEndpoint = (() => {
  const flag = process.env.APGMS_E2E_CHECK_READY ?? "";
  return ["1", "true", "yes"].includes(flag.toLowerCase());
})();

const endpoints = ["/health"] as const;

test.describe("service health", () => {
  for (const endpoint of endpoints) {
    test(`GET ${endpoint} returns ok`, async ({ request }) => {
      const response = await request.get(endpoint);
      expect(response.ok(), `${endpoint} should return 2xx`).toBeTruthy();
      const body = await response.json();
      expect(body).toMatchObject({ ok: true });
    });
  }

  const readinessTest = includeReadyEndpoint ? test : test.fixme;

  readinessTest("GET /ready returns ok", async ({ request }) => {
    const response = await request.get("/ready");
    expect(response.ok(), "/ready should return 2xx").toBeTruthy();
    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
  });
});
