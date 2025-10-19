import { test, expect } from "@playwright/test";
import axe from "axe-core";

const authScript = () => {
  window.sessionStorage.setItem("apgms.auth", "1");
  window.sessionStorage.setItem("apgms.orgId", "test-org");
};

declare global {
  interface Window {
    axe: typeof axe;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(authScript);
});

test("guides the user through onboarding with accessible flow", async ({ page }) => {
  await page.goto("/onboarding");

  await page.addScriptTag({ content: axe.source });

  const nextButton = page.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeDisabled();

  await page.getByLabel("Legal name").fill("Acme Trading Pty Ltd");
  await page.getByLabel("ABN", { exact: false }).fill("12345678901");
  await page.getByLabel("Contact email").fill("finance@acme.test");
  await expect(nextButton).toBeEnabled();

  await nextButton.click();

  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: "Bank Connect" })).toBeVisible();

  const bankNext = page.getByRole("button", { name: "Next" });
  await expect(bankNext).toBeDisabled();

  await page.getByLabel("BSB").fill("062001");
  await page.getByLabel("Account number").fill("123456789");
  await expect(bankNext).toBeEnabled();
  await bankNext.click();

  await expect(page.getByRole("heading", { name: "Policy Select" })).toBeVisible();
  await page.getByLabel("Growth Accelerator").check();
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "Confirm" })).toBeVisible();
  await expect(page.getByText("BSB: ****01")).toBeVisible();
  await expect(page.getByText("Account: ******789")).toBeVisible();
  await expect(page.getByText("Growth Accelerator")).toBeVisible();

  const accessibilityReport = await page.evaluate(async () => {
    return window.axe.run();
  });

  expect(accessibilityReport.violations).toEqual([]);
});
