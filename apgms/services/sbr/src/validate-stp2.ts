import schemaJson from './schema/stp2.schema.json';

export interface Stp2ValidationError {
  /** A dot separated path that points to the offending value. */
  path: string;
  /** Keyword that identifies which JSON Schema rule failed. */
  keyword: string;
  /** Human readable validation message. */
  message: string;
  /** Identifier that maps to an ATO STP Phase 2 validation rule. */
  ruleId: string;
}

type JsonSchema = {
  type?: 'object' | 'string' | 'number' | 'integer';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  pattern?: string;
  minLength?: number;
  enum?: string[];
  format?: 'date';
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  description?: string;
  'x-ruleId'?: string;
};

const ROOT_SCHEMA = schemaJson as JsonSchema;

export function validateStp2(payload: unknown): Stp2ValidationError[] {
  const errors: Stp2ValidationError[] = [];
  validateAgainstSchema(ROOT_SCHEMA, payload, [], ROOT_SCHEMA['x-ruleId'] ?? 'STP2.UNKNOWN', errors);
  return errors;
}

function validateAgainstSchema(
  schema: JsonSchema,
  value: unknown,
  path: string[],
  inheritedRuleId: string,
  errors: Stp2ValidationError[]
): void {
  const ruleId = schema['x-ruleId'] ?? inheritedRuleId;

  switch (schema.type) {
    case 'object':
      validateObject(schema, value, path, ruleId, errors);
      break;
    case 'string':
      validateString(schema, value, path, ruleId, errors);
      break;
    case 'number':
      validateNumber(schema, value, path, ruleId, errors, false);
      break;
    case 'integer':
      validateNumber(schema, value, path, ruleId, errors, true);
      break;
    default:
      // schema without explicit type is treated as permissive but will still walk child properties
      if (schema.properties && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        validateObject(schema, value, path, ruleId, errors);
      }
  }
}

function validateObject(
  schema: JsonSchema,
  value: unknown,
  path: string[],
  ruleId: string,
  errors: Stp2ValidationError[]
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(createError(path, 'type', 'must be an object', ruleId));
    return;
  }

  const typedValue = value as Record<string, unknown>;
  const required = schema.required ?? [];
  const props = schema.properties ?? {};

  for (const property of required) {
    if (!(property in typedValue)) {
      const propertySchema = props[property];
      const propertyRule = propertySchema?.['x-ruleId'] ?? ruleId;
      errors.push(
        createError([...path, property], 'required', `${property} is required`, propertyRule)
      );
    }
  }

  const allowedKeys = new Set(Object.keys(props));
  for (const [key, val] of Object.entries(typedValue)) {
    if (props[key]) {
      validateAgainstSchema(props[key], val, [...path, key], props[key]['x-ruleId'] ?? ruleId, errors);
    } else if (schema.additionalProperties === false) {
      errors.push(createError([...path, key], 'additionalProperties', `${key} is not permitted`, ruleId));
    }
  }
}

function validateString(
  schema: JsonSchema,
  value: unknown,
  path: string[],
  ruleId: string,
  errors: Stp2ValidationError[]
): void {
  if (typeof value !== 'string') {
    errors.push(createError(path, 'type', 'must be a string', ruleId));
    return;
  }

  if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
    errors.push(
      createError(path, 'minLength', `must contain at least ${schema.minLength} characters`, ruleId)
    );
  }

  if (schema.pattern) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      const message = schema.description ?? `must match pattern ${schema.pattern}`;
      errors.push(createError(path, 'pattern', message, ruleId));
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(
      createError(path, 'enum', `must be one of: ${schema.enum.join(', ')}`, ruleId)
    );
  }

  if (schema.format === 'date' && !isValidIsoDate(value)) {
    errors.push(
      createError(path, 'format', 'must be a valid ISO-8601 date (YYYY-MM-DD)', ruleId)
    );
  }
}

function validateNumber(
  schema: JsonSchema,
  value: unknown,
  path: string[],
  ruleId: string,
  errors: Stp2ValidationError[],
  mustBeInteger: boolean
): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    errors.push(createError(path, 'type', 'must be a number', ruleId));
    return;
  }

  if (mustBeInteger && !Number.isInteger(value)) {
    errors.push(createError(path, 'type', 'must be an integer', ruleId));
    return;
  }

  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    errors.push(
      createError(path, 'minimum', `must be greater than or equal to ${schema.minimum}`, ruleId)
    );
  }

  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    errors.push(
      createError(path, 'maximum', `must be less than or equal to ${schema.maximum}`, ruleId)
    );
  }

  if (typeof schema.multipleOf === 'number' && !isMultipleOf(value, schema.multipleOf)) {
    errors.push(
      createError(path, 'multipleOf', `must be a multiple of ${schema.multipleOf}`, ruleId)
    );
  }
}

function createError(path: string[], keyword: string, message: string, ruleId: string): Stp2ValidationError {
  const joinedPath = path.length === 0 ? 'payload' : path.join('.');
  return { path: joinedPath, keyword, message, ruleId };
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function isMultipleOf(value: number, divisor: number): boolean {
  const quotient = value / divisor;
  const tolerance = 1e-9;
  return Math.abs(quotient - Math.round(quotient)) <= tolerance;
}
