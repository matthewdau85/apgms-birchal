import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ReportRequestSchema = z
  .object({
    reportType: z.enum([
      "COMPLIANCE_SUMMARY",
      "PAYMENT_HISTORY",
      "TAX_OBLIGATIONS",
      "DISCREPANCY_LOG",
    ]),
    startDate: z.string().regex(ISO_DATE_REGEX, {
      message: "startDate must be in YYYY-MM-DD format",
    }),
    endDate: z.string().regex(ISO_DATE_REGEX, {
      message: "endDate must be in YYYY-MM-DD format",
    }),
  })
  .refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }

    if (end < start) {
      return false;
    }

    const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    return diffInDays <= 366;
  }, {
    message: "endDate must be on or after startDate and the range cannot exceed 366 days",
    path: ["endDate"],
  });

export const ReportOutSchema = z.object({
  reportId: z.string(),
});

export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export type ReportOut = z.infer<typeof ReportOutSchema>;
