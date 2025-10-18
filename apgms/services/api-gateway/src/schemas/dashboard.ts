import { z } from "zod";
import { cuidSchema, moneyOutputSchema } from "./common";
import { bankLineSchema } from "./bank-lines";
import { rptSchema } from "./rpt";

export const dashboardAccountSchema = z.object({
  accountId: cuidSchema,
  name: z.string().min(1),
  balance: moneyOutputSchema,
});

export const dashboardResponseSchema = z.object({
  org: z.object({
    id: cuidSchema,
    name: z.string().min(1),
  }),
  accounts: z.array(dashboardAccountSchema),
  recentBankLines: z.array(bankLineSchema),
  outstandingRpts: z.array(rptSchema),
});

export type DashboardAccount = z.infer<typeof dashboardAccountSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
