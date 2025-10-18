import { createHash } from "node:crypto";
import { z } from "zod";

export class AllocationError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "AllocationError";
  }
}

export const allocationItemSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
  amount: z.coerce.number().finite("amount must be a finite number"),
  memo: z
    .string()
    .trim()
    .max(1024, "memo must be at most 1024 characters")
    .optional(),
});

export const previewAllocationsSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  bankLineId: z.string().min(1, "bankLineId is required"),
  policyHash: z.string().min(1, "policyHash is required"),
  allocations: z.array(allocationItemSchema).min(1, "allocations must not be empty"),
});

export const applyAllocationsSchema = previewAllocationsSchema.extend({
  prevHash: z.string().min(1, "prevHash is required"),
});

export type AllocationItem = {
  invoiceId: string;
  amount: number;
  memo: string | null;
};
export type PreviewAllocationsInput = z.infer<typeof previewAllocationsSchema>;
export type ApplyAllocationsInput = z.infer<typeof applyAllocationsSchema>;

export interface AllocationPreview {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: AllocationItem[];
  totalAllocated: number;
  hash: string;
}

const hashPreviewBase = (preview: Omit<AllocationPreview, "hash">) =>
  createHash("sha256").update(JSON.stringify(preview)).digest("hex");

const normalizeAllocations = (
  allocations: ReadonlyArray<{ invoiceId: string; amount: number; memo?: string | null }>,
): AllocationItem[] =>
  allocations.map((allocation) => ({
    invoiceId: allocation.invoiceId,
    amount: Number(allocation.amount),
    memo: allocation.memo ?? null,
  }));

export const previewAllocations = (input: PreviewAllocationsInput): AllocationPreview => {
  const allocations = normalizeAllocations(input.allocations);

  if (allocations.some((allocation) => !Number.isFinite(allocation.amount))) {
    throw new AllocationError("invalid_allocation_amount", "Allocation amounts must be finite numbers");
  }

  if (allocations.some((allocation) => allocation.amount <= 0)) {
    throw new AllocationError("invalid_allocation_amount", "Allocation amounts must be positive");
  }

  const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);

  if (!Number.isFinite(totalAllocated) || totalAllocated <= 0) {
    throw new AllocationError("invalid_total", "Total allocation must be positive and finite");
  }

  const base = {
    orgId: input.orgId,
    bankLineId: input.bankLineId,
    policyHash: input.policyHash,
    allocations,
    totalAllocated,
  } satisfies Omit<AllocationPreview, "hash">;

  return {
    ...base,
    hash: hashPreviewBase(base),
  };
};

export const verifyConservation = (preview: AllocationPreview, expectedHash: string): string => {
  const base: Omit<AllocationPreview, "hash"> = {
    orgId: preview.orgId,
    bankLineId: preview.bankLineId,
    policyHash: preview.policyHash,
    allocations: normalizeAllocations(preview.allocations),
    totalAllocated: preview.totalAllocated,
  };

  const computedHash = hashPreviewBase(base);

  if (preview.hash !== computedHash) {
    throw new AllocationError("preview_hash_mismatch", "Preview hash does not match computed value");
  }

  if (expectedHash !== computedHash) {
    throw new AllocationError("invalid_prev_hash", "prevHash does not match preview");
  }

  if (base.totalAllocated <= 0) {
    throw new AllocationError("invalid_total", "Total allocation must be positive");
  }

  if (base.allocations.some((allocation) => allocation.amount <= 0)) {
    throw new AllocationError("invalid_allocation_amount", "Allocation amounts must be positive");
  }

  return computedHash;
};
