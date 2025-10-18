export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "validation_error"
  | "not_found"
  | "bad_request"
  | "conflict"
  | "workflow_error"
  | "internal";

export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const createErrorResponse = (err: ServiceError | Error) => {
  if (err instanceof ServiceError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
  }

  return {
    error: {
      code: "internal" as const,
      message: "An unexpected error occurred",
    },
  };
};
