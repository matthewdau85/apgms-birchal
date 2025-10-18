export const AllocationStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
} as const;

export type AllocationStatus = (typeof AllocationStatus)[keyof typeof AllocationStatus];

export const AllocationStatusValues = Object.values(AllocationStatus);
