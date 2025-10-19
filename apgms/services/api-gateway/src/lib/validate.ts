import type { ZodTypeAny } from "zod";

export function validateReply<T>(schema: ZodTypeAny, data: T): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      console.error("Response validation failed", err, { data });
      return data;
    }
    throw err;
  }
}
