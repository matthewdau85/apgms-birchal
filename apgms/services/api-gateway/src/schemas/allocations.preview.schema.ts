import { z } from "zod";

export const gateStateSchema = z.enum(["open", "closed", "suspended"]);

export const gateConfigSchema = z.object({
  id: z.string().min(1, "Gate id is required"),
  state: gateStateSchema,
  weight: z
    .number({ invalid_type_error: "Weight must be a number" })
    .int("Weight must be an integer")
    .nonnegative("Weight must be non-negative"),
});

export const allocationPreviewRequestSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .int("Amount must be an integer")
    .nonnegative("Amount must be non-negative"),
  gates: z.array(gateConfigSchema).min(1, "At least one gate is required"),
});

export const allocationRecordSchema = z.object({
  gateId: z.string(),
  amount: z.number().int().nonnegative(),
  state: gateStateSchema,
});

export const allocationPreviewResponseSchema = z.object({
  amount: z.number().int().nonnegative(),
  allocations: z.array(allocationRecordSchema),
});

export type AllocationPreviewRequest = z.infer<typeof allocationPreviewRequestSchema>;
export type AllocationRecord = z.infer<typeof allocationRecordSchema>;
export type AllocationPreviewResponse = z.infer<typeof allocationPreviewResponseSchema>;
