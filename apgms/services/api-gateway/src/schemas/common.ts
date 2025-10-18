import { z } from "zod";

export const zId = z.string().min(1, "id_required");
export const zOrgId = zId;
export const zDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "invalid_date",
});
export const zMoneyCents = z.number().int().min(0);
