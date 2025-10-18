import { z } from "zod";
import { zDate, zId, zMoneyCents, zOrgId } from "./common";

const zNonEmptyString = z.string().min(1);

export const CreateBankLineBody = z.object({
  orgId: zOrgId,
  date: zDate,
  amountCents: zMoneyCents,
  payee: zNonEmptyString,
  desc: zNonEmptyString,
});

export const BankLineResp = z.object({
  id: zId,
  orgId: zOrgId,
  date: zDate,
  amountCents: zMoneyCents,
  payee: zNonEmptyString,
  desc: zNonEmptyString,
  createdAt: zDate,
});

export const ListBankLinesQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export const ListBankLinesResp = z.object({
  lines: z.array(BankLineResp),
});

export type CreateBankLineBodyInput = z.infer<typeof CreateBankLineBody>;
export type BankLineRespOutput = z.infer<typeof BankLineResp>;
export type ListBankLinesQueryInput = z.infer<typeof ListBankLinesQuery>;
export type ListBankLinesRespOutput = z.infer<typeof ListBankLinesResp>;
