import {
  DASHBOARD_SCHEMA,
  BANK_LINE_SCHEMA,
  BANK_LINE_CREATE_SCHEMA,
  BANK_LINE_LIST_SCHEMA,
  BANK_LINE_QUERY_SCHEMA,
  AUDIT_REPORT_SCHEMA,
  AUDIT_LEDGER_SCHEMA,
  AUDIT_LEDGER_QUERY_SCHEMA,
  ALLOCATION_REQUEST_SCHEMA,
  ALLOCATION_PREVIEW_RESPONSE_SCHEMA,
  ALLOCATION_APPLY_RESPONSE_SCHEMA,
  POLICY_SCHEMA,
  POLICY_LIST_SCHEMA,
  POLICY_CREATE_SCHEMA,
} from "./schemas/index.js";
import { z, type ZodTypeAny } from "zod";

const ERROR_SCHEMA = z.object({
  error: z.string(),
  context: z.string().optional(),
});

type JsonSchema = Record<string, unknown>;

type Unwrapped = {
  schema: ZodTypeAny;
  optional: boolean;
  nullable: boolean;
  defaultValue: unknown;
};

function unwrap(schema: ZodTypeAny): Unwrapped {
  if (!schema) {
    throw new Error("Cannot unwrap an undefined schema");
  }
  let current: ZodTypeAny = schema;
  let optional = false;
  let nullable = false;
  let defaultValue: unknown = undefined;

  while (true) {
    if (current instanceof z.ZodDefault) {
      optional = true;
      defaultValue = current._def.defaultValue;
      current = current._def.innerType;
      continue;
    }
    if (current instanceof z.ZodOptional) {
      optional = true;
      current = current._def.innerType;
      continue;
    }
    if (current instanceof z.ZodNullable) {
      nullable = true;
      current = current._def.innerType;
      continue;
    }
    break;
  }

  return { schema: current, optional, nullable, defaultValue };
}

function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  const { schema: inner, nullable, defaultValue } = unwrap(schema);
  let json: JsonSchema = {};

  if (inner instanceof z.ZodObject) {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(inner.shape)) {
      const unwrapped = unwrap(value as ZodTypeAny);
      const propertySchema = zodToJsonSchema(unwrapped.schema);
      if (unwrapped.nullable) {
        propertySchema.nullable = true;
      }
      if (unwrapped.defaultValue !== undefined) {
        propertySchema.default = unwrapped.defaultValue;
      }
      properties[key] = propertySchema;
      if (!unwrapped.optional) {
        required.push(key);
      }
    }
    json = { type: "object", properties };
    if (required.length > 0) {
      json.required = required;
    }
  } else if (inner instanceof z.ZodArray) {
    const itemSchema = zodToJsonSchema(inner.element);
    json = { type: "array", items: itemSchema };
  } else if (inner instanceof z.ZodEnum) {
    json = { type: "string", enum: [...inner.options] };
  } else if (inner instanceof z.ZodString) {
    json = { type: "string" };
    if (inner.minLength !== null) {
      json.minLength = inner.minLength;
    }
    if (inner.maxLength !== null) {
      json.maxLength = inner.maxLength;
    }
    const formatCheck = inner._def.checks?.find((check: any) => typeof check?.format === "string");
    if (formatCheck?.format) {
      json.format = formatCheck.format === "datetime" ? "date-time" : formatCheck.format;
    }
  } else if (inner instanceof z.ZodNumber) {
    json = { type: inner.isInt ? "integer" : "number" };
    if (Number.isFinite(inner.minValue)) {
      json.minimum = inner.minValue;
    }
    if (Number.isFinite(inner.maxValue)) {
      json.maximum = inner.maxValue;
    }
  } else if (inner instanceof z.ZodBoolean) {
    json = { type: "boolean" };
  } else {
    json = {};
  }

  if (nullable) {
    json.nullable = true;
  }
  if (defaultValue !== undefined) {
    json.default = defaultValue;
  }

  return json;
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

export function buildOpenApiDocument() {
  const componentSchemas = {
    Dashboard: DASHBOARD_SCHEMA,
    BankLine: BANK_LINE_SCHEMA,
    BankLineCreate: BANK_LINE_CREATE_SCHEMA,
    BankLineList: BANK_LINE_LIST_SCHEMA,
    BankLineQuery: BANK_LINE_QUERY_SCHEMA,
    AuditReport: AUDIT_REPORT_SCHEMA,
    AuditLedger: AUDIT_LEDGER_SCHEMA,
    AuditLedgerQuery: AUDIT_LEDGER_QUERY_SCHEMA,
    AllocationRequest: ALLOCATION_REQUEST_SCHEMA,
    AllocationPreview: ALLOCATION_PREVIEW_RESPONSE_SCHEMA,
    AllocationApply: ALLOCATION_APPLY_RESPONSE_SCHEMA,
    Policy: POLICY_SCHEMA,
    PolicyList: POLICY_LIST_SCHEMA,
    PolicyCreate: POLICY_CREATE_SCHEMA,
    Error: ERROR_SCHEMA,
  } as const;

  const schemas = Object.fromEntries(
    Object.entries(componentSchemas).map(([name, schema]) => {
      if (!schema) {
        throw new Error(`Schema ${name} is undefined`);
      }
      // eslint-disable-next-line no-console
      // console.log(name, schema._def?.typeName);
      return [name, zodToJsonSchema(schema)];
    }),
  );

  return {
    openapi: "3.1.0",
    info: {
      title: "API Gateway",
      version: "1.0.0",
    },
    paths: {
      "/dashboard": {
        get: {
          summary: "Retrieve dashboard metrics",
          responses: {
            "200": {
              description: "Dashboard snapshot",
              content: {
                "application/json": {
                  schema: ref("Dashboard"),
                },
              },
            },
          },
        },
      },
      "/bank-lines": {
        get: {
          summary: "List bank lines",
          parameters: [
            {
              name: "take",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 200, default: 20 },
              description: "Number of records to return (default 20, max 200).",
            },
            {
              name: "cursor",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Pagination cursor from the previous page.",
            },
          ],
          responses: {
            "200": {
              description: "Bank lines page",
              content: {
                "application/json": {
                  schema: ref("BankLineList"),
                },
              },
            },
            "400": {
              description: "Invalid query parameters",
              content: {
                "application/json": {
                  schema: ref("Error"),
                },
              },
            },
          },
        },
        post: {
          summary: "Create a bank line",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              description: "Unique key to ensure the mutation executes only once.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("BankLineCreate"),
              },
            },
          },
          responses: {
            "201": {
              description: "Bank line created",
              content: {
                "application/json": {
                  schema: ref("BankLine"),
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: ref("Error"),
                },
              },
            },
          },
        },
      },
      "/audit/rpt/{id}": {
        get: {
          summary: "Retrieve an audit report for an organisation",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Organisation identifier.",
            },
          ],
          responses: {
            "200": {
              description: "Audit report",
              content: {
                "application/json": {
                  schema: ref("AuditReport"),
                },
              },
            },
            "404": {
              description: "Report not found",
              content: {
                "application/json": {
                  schema: ref("Error"),
                },
              },
            },
          },
        },
      },
      "/audit/ledger": {
        get: {
          summary: "List ledger entries",
          parameters: [
            {
              name: "orgId",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional organisation identifier to filter entries.",
            },
          ],
          responses: {
            "200": {
              description: "Ledger entries",
              content: {
                "application/json": {
                  schema: ref("AuditLedger"),
                },
              },
            },
          },
        },
      },
      "/allocations/preview": {
        post: {
          summary: "Preview allocation results",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              schema: { type: "string" },
              description: "Unique key to ensure the mutation executes only once.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("AllocationRequest"),
              },
            },
          },
          responses: {
            "200": {
              description: "Allocation preview",
              content: {
                "application/json": {
                  schema: ref("AllocationPreview"),
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: ref("Error"),
                },
              },
            },
          },
        },
      },
      "/allocations/apply": {
        post: {
          summary: "Apply allocations",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              schema: { type: "string" },
              description: "Unique key to ensure the mutation executes only once.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("AllocationRequest"),
              },
            },
          },
          responses: {
            "200": {
              description: "Allocation applied",
              content: {
                "application/json": {
                  schema: ref("AllocationApply"),
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: ref("Error"),
                },
              },
            },
          },
        },
      },
      "/policies": {
        get: {
          summary: "List policies",
          responses: {
            "200": {
              description: "Policy collection",
              content: {
                "application/json": {
                  schema: ref("PolicyList"),
                },
              },
            },
          },
        },
        post: {
          summary: "Create a policy",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              schema: { type: "string" },
              description: "Unique key to ensure the mutation executes only once.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref("PolicyCreate"),
              },
            },
          },
          responses: {
            "201": {
              description: "Policy created",
              content: {
                "application/json": {
                  schema: ref("Policy"),
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: ref("Error"),
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas,
    },
  };
}
