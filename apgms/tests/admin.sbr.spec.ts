import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminSbrPage, { SbrMessage } from "../webapp/src/routes/admin/sbr";

const fixtureMessages: SbrMessage[] = [
  {
    id: "fixture-1",
    endpoint: "https://example.gov.au/sbr",
    createdAt: new Date("2024-05-12T05:10:00Z").toISOString(),
    status: "SENT",
    summary: "Payroll batch uploaded",
  },
  {
    id: "fixture-2",
    endpoint: "https://backup.example.gov.au/sbr",
    createdAt: new Date("2024-05-11T22:30:00Z").toISOString(),
    status: "QUEUED",
    summary: "Activity statement ready for delivery",
  },
];

async function mountAdminSbr(page: Page, messages: SbrMessage[] = fixtureMessages) {
  const markup = renderToStaticMarkup(<AdminSbrPage initialMessages={messages} />);
  await page.setContent(`<!DOCTYPE html><html lang="en"><body><div id="root">${markup}</div></body></html>`);
}

test.describe("admin sbr page", () => {
  test("renders endpoint management and recent messages", async ({ page }) => {
    await mountAdminSbr(page);

    await expect(page.getByRole("heading", { name: "ATO SBR controls" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Endpoint URL" })).toHaveValue("https://example.gov.au/sbr");
    await expect(page.getByRole("button", { name: "Send test ping" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("cell", { name: "SENT" })).toBeVisible();
  });

  test("is accessible according to axe", async ({ page }) => {
    await mountAdminSbr(page);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
