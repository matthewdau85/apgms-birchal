import { renderUserSummary } from "./userView";

if (process.env.NODE_ENV !== "test") {
  console.log(renderUserSummary([{ email: "demo@example.com", orgId: "org-1" }]));
}
