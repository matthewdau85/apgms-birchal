import { z, ZodError } from "zod";

export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const validationErrorResponseSchema = z.object({
  error: z.literal("validation_error"),
  issues: z.array(validationIssueSchema),
});

export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

export const normalizeValidationError = (error: unknown): ValidationErrorResponse | null => {
  if (!(error instanceof ZodError)) {
    return null;
  }

  const issues = error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "<root>",
    message: issue.message,
  }));

  return {
    error: "validation_error",
    issues,
  };
};
