import { z } from "zod";
import { BANK_LINE_SCHEMA } from "./bank-lines.js";

export const AUDIT_REPORT_SCHEMA = z.object({
  orgId: z.string(),
  totals: z.object({
    transactions: z.number().int().nonnegative(),
    inflow: z.number(),
    outflow: z.number(),
    net: z.number(),
  }),
  payees: z.array(
    z.object({
      name: z.string(),
      transactions: z.number().int().nonnegative(),
      total: z.number(),
    }),
  ),
});

export const AUDIT_LEDGER_SCHEMA = z.object({
  count: z.number().int().nonnegative(),
  entries: z.array(BANK_LINE_SCHEMA),
});

export const AUDIT_LEDGER_QUERY_SCHEMA = z.object({
  orgId: z.string().optional(),
});
