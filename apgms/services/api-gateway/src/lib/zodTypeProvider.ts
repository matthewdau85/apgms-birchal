import type { FastifyTypeProvider } from "fastify";
import { ZodError, type ZodTypeAny, z } from "zod";

export interface ZodTypeProvider extends FastifyTypeProvider {
  output: this["input"] extends ZodTypeAny ? z.output<this["input"]> : never;
  input: this["schema"] extends ZodTypeAny ? z.input<this["schema"]> : never;
}

export const validatorCompiler = (routeSchema: { schema: unknown }) => {
  const zodSchema = routeSchema.schema as ZodTypeAny | undefined;
  if (!zodSchema) {
    return (data: unknown) => data;
  }

  return (data: unknown) => {
    const result = zodSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }

    return { error: new ZodError(result.error.issues) };
  };
};

export const serializerCompiler = (routeSchema: { schema: unknown }) => {
  const zodSchema = routeSchema.schema as ZodTypeAny | undefined;
  if (!zodSchema) {
    return (data: unknown) => JSON.stringify(data);
  }

  return (data: unknown) => JSON.stringify(zodSchema.parse(data));
};
