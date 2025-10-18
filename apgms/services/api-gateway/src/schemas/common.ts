import { z } from "zod";

export const zId = z.string().min(1);

export const zOrgId = z.string().min(1);

export const zDate = z.string().datetime();

export const zMoneyCents = z.number().int().nonnegative();
