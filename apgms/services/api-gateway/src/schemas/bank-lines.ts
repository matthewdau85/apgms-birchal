import { z } from "zod";
import { zDate, zId, zMoneyCents, zOrgId } from "./common";

export const CreateBankLineBody = z.object({
  orgId: zOrgId,
  date: zDate,
  amountCents: zMoneyCents,
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const BankLineResp = z.object({
  id: zId,
  orgId: zOrgId,
  date: zDate,
  amountCents: zMoneyCents,
  payee: z.string(),
  desc: z.string(),
  createdAt: zDate,
});

export const ListBankLinesQuery = z.object({
  orgId: zOrgId,
  take: z.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});
