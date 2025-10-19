import { z } from "zod";
import { allocationRecordSchema } from "./allocations.preview.schema";

export const ledgerEntryInputSchema = allocationRecordSchema.pick({
  gateId: true,
  amount: true,
}).extend({
  orgId: z.string().min(1, "orgId is required"),
});

export const ledgerEntrySchema = ledgerEntryInputSchema.extend({
  id: z.string(),
  createdAt: z.date(),
});

export type LedgerEntryInput = z.infer<typeof ledgerEntryInputSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
