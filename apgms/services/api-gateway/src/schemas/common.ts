import { z } from "zod";

export const zId = z.string().cuid();
export const zOrgId = zId;
export const zDateISO = z.string().datetime({ offset: true });
export const zMoneyCents = z.coerce.number().int();

export type Id = z.infer<typeof zId>;
export type OrgId = z.infer<typeof zOrgId>;
export type DateISO = z.infer<typeof zDateISO>;
export type MoneyCents = z.infer<typeof zMoneyCents>;
