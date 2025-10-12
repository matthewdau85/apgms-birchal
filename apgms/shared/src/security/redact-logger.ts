export interface PinoLikeHooks {
  logMethod(args: unknown[], method: (...args: unknown[]) => void): void;
}

export interface PinoChildOptions {
  redact?: {
    paths: string[];
    censor: string;
  };
  hooks?: PinoLikeHooks;
}

export interface PinoLikeLogger {
  child(bindings?: Record<string, unknown>, options?: PinoChildOptions): PinoLikeLogger;
  [key: string]: unknown;
}

export interface RedactLoggerOptions {
  paths?: string[];
  censor?: string;
}

const defaultPaths = [
  'password',
  'secret',
  'token',
  'headers.authorization',
  'req.headers.authorization',
];

const sensitiveKeyPattern = /(password|secret|token|key)$/i;
const TFN_REGEX = /\b\d{8,9}\b/g;
const ABN_REGEX = /\b\d{11}\b/g;
const PAN_REGEX = /\b(?:\d[ -]?){13,19}\b/g;
const REDACTION = '[REDACTED]';

function redactString(value: string): string {
  return value.replace(TFN_REGEX, REDACTION).replace(ABN_REGEX, REDACTION).replace(PAN_REGEX, REDACTION);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function deepRedact(
  value: unknown,
  matchers: string[][],
  currentPath: string[] = [],
  parentKey?: string,
): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }

  const shouldRedactPath = matchers.some((matcher) => matcher.every((segment, index) => segment === currentPath[index]));

  if (shouldRedactPath || (typeof parentKey === 'string' && sensitiveKeyPattern.test(parentKey))) {
    return REDACTION;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => deepRedact(item, matchers, [...currentPath, String(index)], parentKey));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, val]) => {
      const nextPath = [...currentPath, key];
      acc[key] = deepRedact(val, matchers, nextPath, key);
      return acc;
    }, {});
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export function createRedactingLogger(baseLogger: PinoLikeLogger, options?: RedactLoggerOptions): PinoLikeLogger {
  const paths = Array.from(new Set([...(options?.paths ?? []), ...defaultPaths]));
  const censor = options?.censor ?? REDACTION;
  const matchers = paths.map((path) => path.split('.'));
  const childOptions: PinoChildOptions = {
    redact: {
      paths,
      censor,
    },
    hooks: {
      logMethod(args, method) {
        const redactedArgs = args.map((value) => deepRedact(value, matchers));
        method.apply(this, redactedArgs);
      },
    },
  };

  return baseLogger.child({}, childOptions);
}
