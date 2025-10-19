import { z } from 'zod';

export const reportTypeEnum = z.enum([
  'COMPLIANCE_SUMMARY',
  'PAYMENT_HISTORY',
  'TAX_OBLIGATIONS',
  'DISCREPANCY_LOG',
]);

export const reportRequestSchema = z
  .object({
    reportType: reportTypeEnum,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  })
  .refine(
    (d) =>
      new Date(`${d.endDate}T23:59:59Z`).getTime() >=
      new Date(`${d.startDate}T00:00:00Z`).getTime(),
    {
      message: 'End date must be after or equal to start date',
      path: ['endDate'],
    }
  )
  .refine((d) => {
    const ms =
      new Date(`${d.endDate}T23:59:59Z`).getTime() -
      new Date(`${d.startDate}T00:00:00Z`).getTime();
    return ms / 86_400_000 <= 366;
  },
  {
    message: 'Date range cannot exceed 12 months',
    path: ['endDate'],
  });

export type ReportRequest = z.infer<typeof reportRequestSchema>;
