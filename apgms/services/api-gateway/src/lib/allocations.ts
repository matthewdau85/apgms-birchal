import { z } from "zod";

export const allocationItemSchema = z.object({
  allocationId: z.string().min(1, "allocationId is required"),
  amount: z
    .number()
    .finite("amount must be a finite number")
    .nonnegative("amount must be zero or positive"),
  memo: z.string().max(1024).optional(),
});

export const allocationRequestSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  currency: z.string().min(3).max(3),
  total: z.number().finite("total must be a finite number"),
  allocations: z.array(allocationItemSchema).min(1, "allocations must not be empty"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AllocationItem = z.infer<typeof allocationItemSchema>;
export type AllocationRequest = z.infer<typeof allocationRequestSchema>;

export interface AllocationPreview extends AllocationRequest {
  metadata: Record<string, unknown>;
  totals: {
    requested: number;
    allocated: number;
    delta: number;
    conserved: boolean;
  };
}

const EPSILON = 0.000001;

export const previewAllocations = (request: AllocationRequest): AllocationPreview => {
  const allocated = request.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const delta = allocated - request.total;

  return {
    ...request,
    metadata: request.metadata ?? {},
    totals: {
      requested: request.total,
      allocated,
      delta,
      conserved: Math.abs(delta) <= EPSILON,
    },
  };
};
