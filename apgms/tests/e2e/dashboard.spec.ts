import { test, expect } from "@playwright/test";

test("renders mocked users on dashboard", async ({ page }) => {
  await page.route("**/api/users", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        users: [
          { email: "amy@example.com", orgId: "org-1" },
          { email: "zoe@example.com", orgId: "org-2" },
        ],
      }),
      headers: { "content-type": "application/json" },
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "APGMS Control Center" })).toBeVisible();
  await expect(page.getByTestId("user-item")).toHaveCount(2);
  await expect(page.getByTestId("user-item").first()).toHaveText(
    "amy@example.com (org-1)",
  );
});
