import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
