import { ZodError, ZodIssue, ZodSchema } from 'zod';

export interface HttpValidationIssue {
  path: string;
  message: string;
  code: ZodIssue['code'];
}

export interface HttpValidationError {
  statusCode: number;
  message: string;
  issues: HttpValidationIssue[];
}

export class ZodValidationError extends Error {
  constructor(public readonly details: HttpValidationError) {
    super(details.message);
    this.name = 'ZodValidationError';
  }
}

export function zodErrorToHttp(error: ZodError, statusCode = 400): HttpValidationError {
  return {
    statusCode,
    message: 'Validation failed',
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

export interface RequestValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

export type ValidatedRequest<T extends RequestValidationSchemas> = {
  [K in keyof T]: T[K] extends ZodSchema<infer U> ? U : never;
};

export function validateRequest<T extends RequestValidationSchemas>(
  schemas: T,
  data: Partial<Record<keyof T, unknown>>,
): ValidatedRequest<T> {
  const result: Partial<ValidatedRequest<T>> = {};
  const issues: ZodIssue[] = [];

  (Object.keys(schemas) as Array<keyof T>).forEach((key) => {
    const schema = schemas[key];

    if (!schema) {
      return;
    }

    const parsed = schema.safeParse(data[key]);

    if (!parsed.success) {
      issues.push(...parsed.error.issues);
      return;
    }

    result[key] = parsed.data as ValidatedRequest<T>[typeof key];
  });

  if (issues.length) {
    throw new ZodValidationError(zodErrorToHttp(new ZodError(issues)));
  }

  return result as ValidatedRequest<T>;
}

export function validateResponse<T>(schema: ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new ZodValidationError(zodErrorToHttp(parsed.error));
  }

  return parsed.data;
}
