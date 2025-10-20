import { z } from "zod";

export const cashFlowReportTag = "Reports" as const;

export const cashFlowReportQuerySchema = z.object({
  orgId: z
    .string()
    .min(1, { message: "orgId is required" })
    .describe("Unique identifier for the organisation to build the report for."),
  from: z
    .string()
    .datetime({ message: "from must be an ISO 8601 date" })
    .optional()
    .describe("Optional inclusive lower bound for the reporting window."),
  to: z
    .string()
    .datetime({ message: "to must be an ISO 8601 date" })
    .optional()
    .describe("Optional inclusive upper bound for the reporting window."),
})
  .refine(
    (value) => {
      if (!value.from || !value.to) {
        return true;
      }

      return new Date(value.from) <= new Date(value.to);
    },
    {
      message: "from must be before to",
      path: ["from"],
    },
  )
  .describe("Query string used when asking for a cash flow report.");

export type CashFlowReportQuery = z.infer<typeof cashFlowReportQuerySchema>;

export const cashFlowReportSchema = z
  .object({
    id: z.string().describe("Opaque identifier for this generated report."),
    orgId: z
      .string()
      .describe("Identifier for the organisation the report was generated for."),
    generatedAt: z
      .string()
      .datetime()
      .describe("Timestamp indicating when the report was produced."),
    currency: z.string().describe("Currency code used for the monetary fields."),
    period: z
      .object({
        from: z.string().datetime().nullable(),
        to: z.string().datetime().nullable(),
      })
      .describe("Time window the report covers. Dates are ISO strings or null when open ended."),
    totals: z
      .object({
        inflow: z.number().describe("Total sum of positive bank line amounts."),
        outflow: z
          .number()
          .describe("Total sum of absolute values for negative bank line amounts."),
        net: z
          .number()
          .describe("Net total (inflow minus outflow) over the provided time period."),
      })
      .describe("Aggregate monetary figures for the requested organisation."),
    linesAnalyzed: z
      .number()
      .int()
      .nonnegative()
      .describe("Number of bank transaction rows that contributed to the totals."),
  })
  .describe("Cash flow report summarising inflow, outflow and net values over a period.");

export type CashFlowReport = z.infer<typeof cashFlowReportSchema>;

export const cashFlowReportResponseSchema = z
  .object({
    report: cashFlowReportSchema,
  })
  .describe("Envelope returned from the cash flow endpoint.");

export type CashFlowReportResponse = z.infer<typeof cashFlowReportResponseSchema>;

export const validationIssueSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number()])).describe("Location of the issue within the payload."),
    message: z.string().describe("Human readable validation error message."),
    code: z.string().describe("Zod error code for the issue."),
  })
  .describe("Single validation issue raised by schema parsing.");

export const validationErrorResponseSchema = z
  .object({
    statusCode: z.literal(400),
    error: z.literal("Bad Request"),
    message: z.string(),
    issues: z.array(validationIssueSchema),
  })
  .describe("Standardised structure describing validation failures.");

export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;
