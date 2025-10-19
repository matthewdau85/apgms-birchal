import type { FastifyBaseLogger } from "fastify";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BSB_PATTERN = /\b\d{3}[- ]?\d{3}\b/g;
const ACCOUNT_PATTERN = /\b(account(?:number)?|acc(?:ount)?)[^\dA-Z]*([0-9]{6,12})\b/gi;
const TOKEN_PAIR_PATTERN = /(token|secret|bearer)\s*[:=]\s*([^\s,]+)/gi;
const BEARER_PATTERN = /(bearer)\s+([A-Za-z0-9._-]{8,})/gi;

const KEY_REDACTORS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /email/i, replacement: "[REDACTED_EMAIL]" },
  { pattern: /token|secret|bearer/i, replacement: "[REDACTED_TOKEN]" },
  { pattern: /bsb/i, replacement: "[REDACTED_BSB]" },
  { pattern: /acc(?:ount)?|iban|routing/i, replacement: "[REDACTED_ACCOUNT]" },
];

export type RedactableValue = unknown;

export function redactString(input: string): string {
  let result = input.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
  result = result.replace(BSB_PATTERN, "[REDACTED_BSB]");
  result = result.replace(ACCOUNT_PATTERN, (_match, prefix: string) => `${prefix} [REDACTED_ACCOUNT]`);
  result = result.replace(TOKEN_PAIR_PATTERN, (_match, key: string) => `${key}: [REDACTED_TOKEN]`);
  result = result.replace(BEARER_PATTERN, (_match, scheme: string) => `${scheme} [REDACTED_TOKEN]`);
  return result;
}

export function redactValue(value: RedactableValue, keyHint?: string): RedactableValue {
  if (value === null || value === undefined) {
    return value;
  }

  const keyReplacement = keyHint
    ? KEY_REDACTORS.find(({ pattern }) => pattern.test(keyHint))?.replacement
    : undefined;

  if (typeof value === "string") {
    return keyReplacement ?? redactString(value);
  }

  if (typeof value === "number") {
    return keyReplacement ? keyReplacement : value;
  }

  if (value instanceof Error) {
    const clone = new (value as Error).constructor(value.message);
    clone.name = value.name;
    clone.stack = value.stack ? redactString(value.stack) : value.stack;
    (clone as any).message = keyReplacement ?? redactString(value.message);
    for (const [prop, propValue] of Object.entries(value)) {
      (clone as any)[prop] = redactValue(propValue, prop);
    }
    return clone;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      const match = KEY_REDACTORS.find(({ pattern }) => pattern.test(entryKey));
      output[entryKey] = match ? match.replacement : redactValue(entryValue, entryKey);
    }
    return output;
  }

  return keyReplacement ?? value;
}

function redactLogArguments(args: unknown[]): unknown[] {
  return args.map((arg) => (typeof arg === "string" ? redactString(arg) : redactValue(arg)));
}

const METHODS: Array<keyof FastifyBaseLogger> = [
  "info",
  "error",
  "warn",
  "debug",
  "trace",
  "fatal",
];

export function createRedactedLogger<T extends FastifyBaseLogger>(logger: T): T {
  const wrapped = Object.create(logger);

  for (const method of METHODS) {
    const original = logger[method].bind(logger) as (...args: unknown[]) => void;
    wrapped[method] = ((...args: unknown[]) => {
      return original(...redactLogArguments(args));
    }) as T[typeof method];
  }

  const originalChild = logger.child.bind(logger) as (bindings?: Record<string, unknown>) => FastifyBaseLogger;
  wrapped.child = ((bindings?: Record<string, unknown>) => {
    const redactedBindings = bindings ? (redactValue(bindings) as Record<string, unknown>) : bindings;
    return createRedactedLogger(originalChild(redactedBindings));
  }) as T["child"];

  return wrapped;
}

export function applyRedaction(logger: FastifyBaseLogger): void {
  const redacted = createRedactedLogger(logger);
  for (const method of [...METHODS, "child" as const]) {
    (logger as any)[method] = redacted[method].bind(redacted);
  }
}
