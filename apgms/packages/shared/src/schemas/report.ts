import { z } from 'zod';

export const reportTypeEnum = z.enum([
  'COMPLIANCE_SUMMARY',
  'PAYMENT_HISTORY',
  'TAX_OBLIGATIONS',
  'DISCREPANCY_LOG',
]);

export const ReportRequestSchema = z.object({
  reportType: reportTypeEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
})
.refine(d => {
  const s = new Date(d.startDate + 'T00:00:00Z').getTime();
  const e = new Date(d.endDate   + 'T23:59:59Z').getTime();
  return e >= s;
}, { message: 'End date must be after or equal to start date', path: ['endDate'] })
.refine(d => {
  const s = new Date(d.startDate + 'T00:00:00Z').getTime();
  const e = new Date(d.endDate   + 'T23:59:59Z').getTime();
  return (e - s) / 86400000 <= 366;
}, { message: 'Date range cannot exceed 12 months', path: ['endDate'] });

export type ReportRequest = z.infer<typeof ReportRequestSchema>;

export const ReportOutSchema = z.object({
  reportId: z.string(),
});
export type ReportOut = z.infer<typeof ReportOutSchema>;
