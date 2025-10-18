import { z } from "zod";
import { bankLineSchema } from "./bank-lines";

export const dashboardResponseSchema = z.object({
  totals: z.object({
    users: z.number().int().nonnegative(),
    bankLines: z.number().int().nonnegative(),
    balance: z.string(),
  }),
  recentBankLines: z.array(bankLineSchema),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
