import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Onboarding flow", () => {
  test("completes happy path with accessible screens", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    await expect(page.getByRole("heading", { name: "Cash overview" })).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("link", { name: "Bank Lines" }).click();
    await expect(page.getByRole("heading", { name: "Bank feeds" })).toBeVisible();
    await expectAxeClean(page);

    await page.getByRole("link", { name: "Onboarding" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to APGMS" })).toBeVisible();
    await expectAxeClean(page);

    await page.getByLabel("Legal name").fill("Birchal Ventures");
    await page.getByLabel("ABN").fill("12345678901");
    await page.getByLabel("Contact email").fill("ops@birchal.test");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(page.getByRole("group", { name: "Connect bank" })).toBeVisible();
    await page.getByLabel("BSB").fill("062123");
    await page.getByLabel("Account number").fill("12345678");
    await page.getByRole("button", { name: "Connect account" }).click();

    await expect(page.getByRole("group", { name: "Select policy" })).toBeVisible();
    await page.locator('input[value="conservative"]').check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Confirm & submit" })).toBeVisible();
    await expect(page.getByText("Birchal Ventures")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByRole("status")).toContainText("You're all set");
    await expectAxeClean(page);
  });
});

async function expectAxeClean(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}
