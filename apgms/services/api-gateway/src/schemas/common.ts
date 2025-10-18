import { z } from "zod";

export const email = z.string().email();
export const cuid = z.string().regex(/^c[0-9a-z]{24}$/i, "Invalid cuid");
export const isoDate = z.string().datetime({ offset: true });
export const moneyCents = z.number().int().nonnegative();
