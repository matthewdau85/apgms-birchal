import { z } from "zod";
import { BANK_LINE_SCHEMA } from "./bank-lines.js";

export const DASHBOARD_SCHEMA = z.object({
  summary: z.object({
    totalOrgs: z.number().int().nonnegative(),
    totalUsers: z.number().int().nonnegative(),
    totalBankLines: z.number().int().nonnegative(),
    totalPolicies: z.number().int().nonnegative(),
  }),
  recentActivity: z.object({
    bankLines: z.array(BANK_LINE_SCHEMA),
  }),
});
