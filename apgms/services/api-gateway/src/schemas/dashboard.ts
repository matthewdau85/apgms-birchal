import { z } from "zod";

export const dashboardResponseSchema = z.object({
  kpis: z.object({
    operating: z.number(),
    taxBuffer: z.number(),
    paygw: z.number(),
    gst: z.number(),
  }),
  series: z.array(z.unknown()),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
