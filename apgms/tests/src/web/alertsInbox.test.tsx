import "../setup/dom";

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { AlertRecord } from "../../../shared/src/alerts";
import { AlertsInbox } from "../../../webapp/src/pages/Alerts/AlertsInbox";

const buildAlert = (overrides: Partial<AlertRecord>): AlertRecord => ({
  id: overrides.id ?? "alert-1",
  orgId: overrides.orgId ?? "org-1",
  ruleId: overrides.ruleId ?? "large-amount",
  summary: overrides.summary ?? "Large amount detected",
  details: overrides.details ?? "",
  status: overrides.status ?? "UNREAD",
  severity: overrides.severity ?? "HIGH",
  metadata: overrides.metadata ?? null,
  createdAt: overrides.createdAt ?? new Date("2024-01-01T12:00:00Z"),
  updatedAt: overrides.updatedAt ?? new Date("2024-01-01T12:00:00Z"),
  readAt: overrides.readAt ?? null,
  bankLineId: overrides.bankLineId ?? null,
});

afterEach(() => cleanup());

describe("web/AlertsInbox", () => {
  it("renders unread counts and allows toggling read state", () => {
    const alerts: AlertRecord[] = [
      buildAlert({ id: "a1", summary: "Large amount detected" }),
      buildAlert({ id: "a2", summary: "Watchlist hit", severity: "CRITICAL" }),
    ];
    render(<AlertsInbox alerts={alerts} />);

    const unreadIndicator = screen.getByText(/Unread:/);
    assert.match(unreadIndicator.textContent ?? "", /2$/);

    const firstAlert = screen.getByText("Large amount detected").closest("li");
    assert.ok(firstAlert);
    assert.ok(firstAlert?.className.includes("alerts-inbox__item--unread"));

    const toggleButton = within(firstAlert as HTMLElement).getByRole("button", { name: "Mark read" });
    fireEvent.click(toggleButton);

    assert.ok((firstAlert as HTMLElement).className.includes("alerts-inbox__item--read"));
    assert.equal(within(firstAlert as HTMLElement).getByText("Read").textContent, "Read");

    const updatedUnread = screen.getByText(/Unread:/);
    assert.match(updatedUnread.textContent ?? "", /1$/);
  });

  it("filters alerts by status, severity, and search term", () => {
    const alerts: AlertRecord[] = [
      buildAlert({ id: "a1", summary: "Large amount detected", status: "UNREAD", severity: "HIGH" }),
      buildAlert({
        id: "a2",
        summary: "Rapid repeat payment",
        status: "READ",
        severity: "MEDIUM",
        ruleId: "rapid-repeat",
        details: "Multiple payments to same vendor",
      }),
      buildAlert({
        id: "a3",
        summary: "Watchlist hit",
        status: "UNREAD",
        severity: "CRITICAL",
        ruleId: "watchlist-payee",
      }),
    ];

    render(<AlertsInbox alerts={alerts} initialFilters={{ status: "ALL" }} />);

    // Apply severity filter
    const severityToggle = screen.getByLabelText("High");
    fireEvent.click(severityToggle);

    // After toggling high severity, only the high severity alert remains
    const visibleSummaries = screen.getAllByRole("listitem").map((item) =>
      within(item).getByText(/Large amount detected|Watchlist hit|Rapid repeat payment/).textContent
    );
    assert.deepEqual(visibleSummaries.filter(Boolean), ["Large amount detected"]);

    // Switch to unread status filter
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));

    // Clear severity filter and apply search
    fireEvent.click(severityToggle);
    const searchInput = screen.getByPlaceholderText("Search alerts");
    fireEvent.change(searchInput, { target: { value: "watchlist" } });

    const listItems = screen.getAllByRole("listitem");
    assert.equal(listItems.length, 1);
    assert.equal(within(listItems[0]).getByText("Watchlist hit").textContent, "Watchlist hit");
  });
});
