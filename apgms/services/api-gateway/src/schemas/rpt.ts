import { z } from "zod";
import { cuidSchema, isoDateTimeSchema, moneyOutputSchema } from "./common";

export const rptStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "expired",
]);

export const rptSchema = z.object({
  id: cuidSchema,
  orgId: cuidSchema,
  debtorName: z.string().min(1),
  creditorName: z.string().min(1),
  amount: moneyOutputSchema,
  currency: z.string().length(3),
  status: rptStatusSchema,
  dueDate: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const rptListResponseSchema = z.object({
  rpts: z.array(rptSchema),
});

export type RptStatus = z.infer<typeof rptStatusSchema>;
export type Rpt = z.infer<typeof rptSchema>;
export type RptListResponse = z.infer<typeof rptListResponseSchema>;
