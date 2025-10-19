import type { FastifyInstance } from "fastify";
import { z, type ZodTypeAny } from "zod";

const OPENAPI_VERSION = "3.0.3";

type JsonSchema = Record<string, unknown>;

type SchemaResult = {
  schema: JsonSchema;
  required: boolean;
};

function convert(schema: ZodTypeAny): SchemaResult {
  if (!schema || typeof (schema as any)._def !== "object") {
    return { schema: {}, required: true };
  }

  const def: any = (schema as any)._def;

  switch (def.type) {
    case "default": {
      const inner = convert(def.innerType);
      const value =
        typeof def.defaultValue === "function"
          ? def.defaultValue()
          : def.defaultValue;
      return {
        schema: { ...inner.schema, default: value },
        required: false,
      };
    }
    case "optional": {
      const inner = convert(def.innerType);
      return { schema: inner.schema, required: false };
    }
    case "nullable": {
      const inner = convert(def.innerType);
      return {
        schema: { anyOf: [inner.schema, { type: "null" }] },
        required: inner.required,
      };
    }
    case "pipe": {
      return convert(def.in ?? def.out);
    }
    case "transform": {
      return convert(def.innerType);
    }
    case "object": {
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        const converted = convert(value as ZodTypeAny);
        properties[key] = converted.schema;
        if (converted.required) {
          required.push(key);
        }
      }
      const base: JsonSchema = {
        type: "object",
        properties,
        additionalProperties: false,
      };
      if (required.length > 0) {
        (base as any).required = required;
      }
      return { schema: base, required: true };
    }
    case "array": {
      const items = convert(def.type);
      return {
        schema: { type: "array", items: items.schema },
        required: true,
      };
    }
    case "union": {
      return {
        schema: {
          anyOf: def.options.map((option: ZodTypeAny) => convert(option).schema),
        },
        required: true,
      };
    }
    case "literal": {
      const value = def.value;
      const schema: JsonSchema = { const: value };
      const valueType = typeof value;
      if (valueType === "string" || valueType === "number" || valueType === "boolean") {
        (schema as any).type = valueType === "number" ? "number" : valueType;
      }
      return { schema, required: true };
    }
    case "boolean":
      return { schema: { type: "boolean" }, required: true };
    case "date":
      return { schema: { type: "string", format: "date-time" }, required: true };
    case "string": {
      const schema: Record<string, unknown> = { type: "string" };
      for (const check of def.checks ?? []) {
        const info = check?._zod?.def;
        if (!info) continue;
        if (info.check === "min_length") {
          schema.minLength = info.minimum;
        }
        if (info.check === "max_length") {
          schema.maxLength = info.maximum;
        }
        if (info.check === "string_format" && info.format) {
          if (info.format === "regex" && info.pattern) {
            schema.pattern = info.pattern.source ?? `${info.pattern}`;
          } else if (info.format === "datetime") {
            schema.format = "date-time";
          } else if (info.format === "email") {
            schema.format = "email";
          }
        }
      }
      return { schema, required: true };
    }
    case "number": {
      const schema: Record<string, unknown> = {
        type: def.checks?.some((check: any) => check?._zod?.def?.format === "safeint")
          ? "integer"
          : "number",
      };
      for (const check of def.checks ?? []) {
        const info = check?._zod?.def;
        if (!info) continue;
        if (info.check === "greater_than") {
          if (info.inclusive) {
            schema.minimum = info.value;
          } else {
            schema.exclusiveMinimum = info.value;
          }
        }
        if (info.check === "less_than") {
          if (info.inclusive) {
            schema.maximum = info.value;
          } else {
            schema.exclusiveMaximum = info.value;
          }
        }
      }
      return { schema, required: true };
    }
    case "bigint":
      return { schema: { type: "integer" }, required: true };
    case "null":
      return { schema: { type: "null" }, required: true };
    default:
      if (schema instanceof z.ZodType) {
        return { schema: { type: "string" }, required: true };
      }
      throw new Error(`Unsupported zod schema: ${def.type}`);
  }
}

function isZodSchema(value: unknown): value is ZodTypeAny {
  return typeof value === "object" && value !== null && "_def" in (value as any);
}

declare module "fastify" {
  interface FastifyInstance {
    swagger(): Record<string, unknown>;
  }
}

export default async function openapiPlugin(app: FastifyInstance | any) {
  const document: Record<string, any> = {
    openapi: OPENAPI_VERSION,
    info: {
      title: "APGMS API Gateway",
      description: "HTTP gateway for APGMS services",
      version: "0.1.0",
    },
    paths: {},
  };

  app.decorate("swagger", () => document);

  app.addHook("onRoute", (route: any) => {
    if ((route.config as any)?.hide) {
      return;
    }
    const methods = Array.isArray(route.method)
      ? route.method.map((method: string) => method.toLowerCase())
      : [route.method?.toLowerCase()].filter(Boolean);

    if (!methods.length) {
      return;
    }

    const pathItem = (document.paths[route.url] ??= {});

    for (const method of methods) {
      const operation: Record<string, any> = {
        responses: {},
      };

      const schema = route.schema as Record<string, unknown> | undefined;

      if (schema?.summary) {
        operation.summary = schema.summary;
      }
      if (schema?.description) {
        operation.description = schema.description;
      }
      if (schema?.tags) {
        operation.tags = schema.tags;
      }

      const query = schema?.querystring;
      if (isZodSchema(query)) {
        const result = convert(query);
        if (result.schema.type === "object") {
          const properties = (result.schema as any).properties ?? {};
          const required = new Set<string>((result.schema as any).required ?? []);
          operation.parameters = Object.entries(properties).map(([name, value]) => ({
            name,
            in: "query",
            required: required.has(name),
            schema: value,
          }));
        }
      }

      const body = schema?.body;
      if (isZodSchema(body)) {
        const result = convert(body);
        operation.requestBody = {
          required: result.required,
          content: {
            "application/json": {
              schema: result.schema,
            },
          },
        };
      }

      const responses = schema?.response as Record<string, ZodTypeAny> | undefined;
      if (responses) {
        for (const [status, responseSchema] of Object.entries(responses)) {
          if (!isZodSchema(responseSchema)) continue;
          const result = convert(responseSchema);
          operation.responses[status] = {
            description: "Successful response",
            content: {
              "application/json": {
                schema: result.schema,
              },
            },
          };
        }
      }

      if (Object.keys(operation.responses).length === 0) {
        operation.responses["200"] = { description: "Success" };
      }

      pathItem[method] = operation;
    }
  });
}
