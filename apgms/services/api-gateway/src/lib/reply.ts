import { ZodTypeAny } from "zod";

export const replyValidate = <T extends ZodTypeAny>(schema: T) => (value: unknown) => schema.parse(value);
