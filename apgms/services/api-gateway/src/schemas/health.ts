import { z } from "zod";

export const Healthz200 = z.object({
  ok: z.boolean(),
  service: z.string(),
});

export type Healthz200 = z.infer<typeof Healthz200>;

export const Readyz200 = z.object({
  ready: z.literal(true),
});

export type Readyz200 = z.infer<typeof Readyz200>;

export const Readyz503 = z.object({
  ready: z.literal(false),
  reason: z.string(),
});

export type Readyz503 = z.infer<typeof Readyz503>;
