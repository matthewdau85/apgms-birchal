import { z } from "zod";

export const allocationSchema = z.object({
  accountId: z.string().min(1, "accountId required"),
  amount: z.number().finite(),
  memo: z.string().min(1).optional(),
});

export const allocationsRequestSchema = z.object({
  orgId: z.string().min(1, "orgId required"),
  bankLineId: z.string().min(1, "bankLineId required"),
  policyHash: z.string().min(1, "policyHash required"),
  allocations: z.array(allocationSchema).min(1, "allocations required"),
  prevHash: z.string().min(1).nullable().optional(),
  now: z.string().datetime().optional(),
});

export type Allocation = z.infer<typeof allocationSchema>;
export type AllocationsRequest = z.infer<typeof allocationsRequestSchema>;
