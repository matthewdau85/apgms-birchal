import { z } from "zod";

export const ReportRequestSchema = z
  .object({
    reportType: z.enum([
      "COMPLIANCE_SUMMARY",
      "PAYMENT_HISTORY",
      "TAX_OBLIGATIONS",
      "DISCREPANCY_LOG",
    ]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine(
    (data) =>
      new Date(`${data.endDate}T23:59:59Z`) >=
      new Date(`${data.startDate}T00:00:00Z`),
    {
      message: "end >= start",
      path: ["endDate"],
    },
  )
  .refine(
    (data) =>
      (new Date(data.endDate).getTime() -
        new Date(data.startDate).getTime()) /
        86_400_000 <=
      366,
    {
      message: "range <= 12 months",
      path: ["endDate"],
    },
  );

export const ReportOutSchema = z.object({
  reportId: z.string(),
});
