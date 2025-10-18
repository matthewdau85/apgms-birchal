import { z } from "zod";

export const zId = z.string().cuid();
export const zOrgId = zId;
export const zMoneyCents = z.coerce.number().int();
export const zIsoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime({ offset: false }));
