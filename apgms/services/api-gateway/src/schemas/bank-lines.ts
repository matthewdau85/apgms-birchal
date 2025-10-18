import { z } from "zod";

export const amountCentsSchema = z
  .union([z.number({ required_error: "amountCents is required" }), z.string()])
  .transform((val) => (typeof val === "string" ? Number(val) : val))
  .refine((val) => Number.isFinite(val), {
    message: "amountCents must be numeric",
  })
  .refine((val) => Number.isInteger(val), {
    message: "amountCents must be an integer",
  })
  .refine((val) => Math.abs(val) <= Number.MAX_SAFE_INTEGER, {
    message: "amountCents must be a safe integer",
  });

export const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime({ message: "date must be an ISO 8601 string" }),
  amountCents: amountCentsSchema,
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime({ message: "createdAt must be an ISO 8601 string" }),
});

export const getBankLinesQuerySchema = z.object({
  orgId: z.string({ required_error: "orgId is required" }).min(1, "orgId is required"),
  cursor: z.string().optional(),
  limit: z.union([z.number(), z.string()]).optional(),
});

export const bankLinesCollectionSchema = z.object({
  bankLines: z.array(bankLineSchema),
  nextCursor: z.string().optional(),
});

export const createBankLineBodySchema = z.object({
  orgId: z.string({ required_error: "orgId is required" }).min(1, "orgId is required"),
  date: z.string().datetime({ message: "date must be an ISO 8601 string" }),
  amountCents: amountCentsSchema,
  payee: z.string({ required_error: "payee is required" }).min(1, "payee is required"),
  desc: z.string({ required_error: "desc is required" }).min(1, "desc is required"),
});

export const createBankLineResponseSchema = z.object({
  bankLine: bankLineSchema,
  idempotencyReplayed: z.boolean(),
});

export type BankLineResponse = z.infer<typeof bankLineSchema>;
export type GetBankLinesResponse = z.infer<typeof bankLinesCollectionSchema>;
export type CreateBankLineResponse = z.infer<typeof createBankLineResponseSchema>;

// JSON Schemas for OpenAPI generation
export const bankLineJsonSchema = {
  type: "object",
  required: ["id", "orgId", "date", "amountCents", "payee", "desc", "createdAt"],
  properties: {
    id: { type: "string", description: "Unique identifier for the bank line" },
    orgId: { type: "string", description: "Organisation identifier" },
    date: {
      type: "string",
      format: "date-time",
      description: "Transaction date in ISO 8601 format",
    },
    amountCents: {
      type: "integer",
      description: "Transaction amount expressed in cents",
    },
    payee: { type: "string", description: "Counterparty name" },
    desc: { type: "string", description: "Transaction description" },
    createdAt: {
      type: "string",
      format: "date-time",
      description: "Record creation timestamp in ISO 8601 format",
    },
  },
} as const;

export const getBankLinesQueryJsonSchema = {
  type: "object",
  required: ["orgId"],
  properties: {
    orgId: { type: "string", description: "Organisation identifier" },
    cursor: {
      type: "string",
      description: "Opaque cursor for pagination (use nextCursor from previous response)",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 200,
      description: "Maximum number of bank lines to return (defaults to 20)",
    },
  },
} as const;

export const bankLinesCollectionJsonSchema = {
  type: "object",
  required: ["bankLines"],
  properties: {
    bankLines: {
      type: "array",
      items: bankLineJsonSchema,
    },
    nextCursor: {
      type: "string",
      description: "Cursor to request the next page, if available",
    },
  },
} as const;

export const createBankLineBodyJsonSchema = {
  type: "object",
  required: ["orgId", "date", "amountCents", "payee", "desc"],
  properties: {
    orgId: { type: "string", description: "Organisation identifier" },
    date: {
      type: "string",
      format: "date-time",
      description: "Transaction date in ISO 8601 format",
    },
    amountCents: {
      type: "integer",
      description: "Transaction amount in cents",
    },
    payee: { type: "string", description: "Counterparty name" },
    desc: { type: "string", description: "Transaction description" },
  },
} as const;

export const createBankLineResponseJsonSchema = {
  type: "object",
  required: ["bankLine", "idempotencyReplayed"],
  properties: {
    bankLine: bankLineJsonSchema,
    idempotencyReplayed: {
      type: "boolean",
      description: "Indicates whether the request was replayed via Idempotency-Key",
    },
  },
} as const;
