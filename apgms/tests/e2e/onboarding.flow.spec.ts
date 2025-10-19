import { test, expect, BrowserContext } from "@playwright/test";
import { injectAxe, checkA11y } from "@axe-core/playwright";

type DraftRecord = {
  token: string;
  data: Record<string, unknown>;
  updatedAt: string;
};

type DraftStore = Map<string, DraftRecord & { completedAt?: string }>;

async function registerOnboardingRoutes(context: BrowserContext, store: DraftStore) {
  await context.route("**/onboarding/draft", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }

    const body = JSON.parse(route.request().postData() ?? "{}");
    const token = body.token ?? `token-${store.size + 1}`;
    const existing = store.get(token);
    const record: DraftRecord = {
      token,
      data: body.data ?? {},
      updatedAt: new Date().toISOString(),
    };
    store.set(token, record);
    await route.fulfill({
      status: existing ? 200 : 201,
      contentType: "application/json",
      body: JSON.stringify(record),
    });
  });

  await context.route(/\/onboarding\/draft\/(.+)$/i, async (route, request) => {
    const token = request.url().split("/").pop() ?? "";
    const record = store.get(token);
    if (!record) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "draft_not_found" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(record),
    });
  });

  await context.route("**/onboarding/complete", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const token: string | undefined = body.token;
    if (!token || !store.has(token)) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "draft_not_found" }),
      });
      return;
    }
    const existing = store.get(token)!;
    const completedAt = new Date().toISOString();
    const mergedData = {
      ...existing.data,
      ...(body.data ?? {}),
      status: "completed",
      completedAt,
    };
    const updated: DraftRecord & { completedAt: string } = {
      token,
      data: mergedData,
      updatedAt: completedAt,
      completedAt,
    };
    store.set(token, updated);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token, status: "completed", completedAt }),
    });
  });
}

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

test.describe("onboarding wizard", () => {
  test("completes onboarding flow and resumes from token", async ({ page, browser }) => {
    const store: DraftStore = new Map();
    await registerOnboardingRoutes(page.context(), store);

    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(`${APP_URL}/onboarding/org`);
    await injectAxe(page);
    await checkA11y(page, "#main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    await page.getByLabel("Organisation name").fill("Birchal Pty Ltd");
    await page
      .getByLabel("Australian Business Number (ABN)")
      .fill("12345678901");
    await page
      .getByLabel("Principal place of business")
      .fill("123 Example Street\nMelbourne VIC 3000");
    await page.getByRole("button", { name: "Continue to bank setup" }).click();

    await page.waitForURL("**/onboarding/bank");
    await checkA11y(page, "#main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    await page.getByRole("button", { name: "Launch PayTo consent" }).click();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("consent-status")).toHaveText("Approved");
    await page.getByRole("button", { name: "Continue to policies" }).click();

    await page.waitForURL("**/onboarding/policies");
    await checkA11y(page, "#main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    await page.getByRole("radio", { name: /Balanced operating/ }).check();
    await page
      .getByRole("button", { name: "Continue to integrations" })
      .click();

    await page.waitForURL("**/onboarding/integrations");
    await checkA11y(page, "#main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    await page.getByRole("button", { name: "Connect" }).first().click();
    await expect(page.getByText("Connected").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Continue to review" })
      .click();

    await page.waitForURL("**/onboarding/review");
    await checkA11y(page, "#main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    await expect(page.getByText("Birchal Pty Ltd")).toBeVisible();
    await page.getByRole("button", { name: "Finish onboarding" }).click();
    await expect(page.getByRole("status")).toContainText("Onboarding completed");

    expect(consoleErrors).toEqual([]);

    const savedToken = await page.evaluate(() =>
      window.localStorage.getItem("apgms:onboarding:draft-token")
    );
    expect(savedToken).toBeTruthy();

    const resumeContext = await browser.newContext();
    await registerOnboardingRoutes(resumeContext, store);
    const resumePage = await resumeContext.newPage();
    await resumePage.goto(`${APP_URL}/onboarding/org?token=${savedToken}`);
    await injectAxe(resumePage);
    await resumePage.waitForSelector("#org-name[value='Birchal Pty Ltd']");
    await checkA11y(resumePage, "#main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
    await resumeContext.close();
  });
});
