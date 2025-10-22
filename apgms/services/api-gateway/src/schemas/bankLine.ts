import { z } from "zod";

export const bankLineInput = z.object({
  externalId: z.string().min(1),
  amountCents: z.number().int(),
  description: z.string().optional(),
  occurredAt: z.string().datetime(),
});
