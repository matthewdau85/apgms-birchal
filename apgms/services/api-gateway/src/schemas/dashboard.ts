import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("api-gateway"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
