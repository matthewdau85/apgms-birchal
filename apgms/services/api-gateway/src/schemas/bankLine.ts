import { z } from "zod";

export const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.number(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string(),
});

export const bankLineListQuerySchema = z.object({
  take: z.coerce.number().min(1).max(200).default(20),
});

export const bankLineListResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

export const createBankLineBodySchema = z.object({
  orgId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const createBankLineResponseSchema = bankLineSchema;

export const bankLineJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    orgId: { type: "string" },
    date: { type: "string", format: "date-time" },
    amount: { type: "number" },
    payee: { type: "string" },
    desc: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "orgId", "date", "amount", "payee", "desc", "createdAt"],
  additionalProperties: false,
} as const;

export const bankLineListResponseJsonSchema = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: bankLineJsonSchema,
    },
  },
  required: ["lines"],
  additionalProperties: false,
} as const;

export const bankLineListQueryJsonSchema = {
  type: "object",
  properties: {
    take: {
      type: "integer",
      minimum: 1,
      maximum: 200,
      default: 20,
    },
  },
  additionalProperties: false,
} as const;

export const createBankLineBodyJsonSchema = {
  type: "object",
  properties: {
    orgId: { type: "string" },
    date: { type: "string", format: "date-time" },
    amount: { type: "number" },
    payee: { type: "string" },
    desc: { type: "string" },
  },
  required: ["orgId", "date", "amount", "payee", "desc"],
  additionalProperties: false,
} as const;

export const createBankLineResponseJsonSchema = bankLineJsonSchema;
