import type { ZodTypeAny } from "zod";

export const replyValidate = <Schema extends ZodTypeAny>(schema: Schema) => {
  return (payload: unknown): ReturnType<Schema["parse"]> => schema.parse(payload);
};
