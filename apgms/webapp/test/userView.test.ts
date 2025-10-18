import { describe, expect, test } from "../../scripts/testing";
import { renderUserSummary } from "../src/userView";

describe("renderUserSummary", () => {
  test("summarises user emails when available", () => {
    expect(
      renderUserSummary([
        { email: "lee@example.com", orgId: "org-1" },
        { email: "sam@example.com", orgId: "org-2" },
      ]),
    ).toBe("lee@example.com (org-1), sam@example.com (org-2)");
  });

  test("shows empty state when there are no users", () => {
    expect(renderUserSummary([])).toBe("No users connected");
  });
});
