import { z } from "zod";

export const PageQuery = z.object({
  take: z.coerce
    .number()
    .int("take must be an integer")
    .min(1, "take must be at least 1")
    .max(200, "take must be at most 200")
    .default(20),
  cursor: z.string().nullish(),
});

export const PageMeta = z.object({
  take: z.number().int().min(1),
  returned: z.number().int().nonnegative(),
  nextCursor: z.string().nullish(),
  hasMore: z.boolean(),
});

export type PageQueryInput = z.infer<typeof PageQuery>;
export type PageMetaOutput = z.infer<typeof PageMeta>;
