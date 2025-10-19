const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BSB_REGEX = /\b\d{3}-\d{3}\b/g;
const ACCOUNT_REGEX = /(\b(?:acc(?:ount)?|acct)\s*[=:]?\s*)(\d{6,12})/gi;
const TOKEN_REGEX = /(\b(?:token|api[_-]?key)\s*[=:]?\s*)([A-Za-z0-9._-]{6,})/gi;
const BEARER_REGEX = /(Bearer\s+)[A-Za-z0-9._-]{6,}/gi;

const MASK = "***REDACTED***";

export type LoggerMethod = (...args: unknown[]) => unknown;
export type LoggerLike = Record<string, unknown> & {
  child?: (...args: unknown[]) => LoggerLike;
};

export function redactString(value: string): string {
  let result = value.replace(EMAIL_REGEX, (match) => {
    const [, domain] = match.split("@");
    return `***@${domain}`;
  });

  result = result.replace(BSB_REGEX, "***-***");
  result = result.replace(ACCOUNT_REGEX, (_, prefix: string, digits: string) => {
    const visible = digits.slice(-2);
    return `${prefix}***${visible}`;
  });
  result = result.replace(TOKEN_REGEX, (_, prefix: string) => `${prefix}${MASK}`);
  result = result.replace(BEARER_REGEX, (_, prefix: string) => `${prefix}${MASK}`);

  return result;
}

export function redactValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactString(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item)) as unknown as T;
  }

  if (value && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      clone[key] = redactValue(val);
    }
    return clone as T;
  }

  return value;
}

const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"]; 

export function applyLogRedaction<T extends LoggerLike>(logger: T): T {
  for (const level of LEVELS) {
    const method = logger[level];
    if (typeof method === "function") {
      const original = method.bind(logger);
      Object.defineProperty(logger, level, {
        value: (...args: unknown[]) => original(...args.map((arg) => redactValue(arg))),
        writable: true,
      });
    }
  }

  if (typeof logger.child === "function") {
    const originalChild = logger.child.bind(logger);
    Object.defineProperty(logger, "child", {
      value: (...args: unknown[]) => {
        const childLogger = originalChild(...args);
        return applyLogRedaction(childLogger);
      },
      writable: true,
    });
  }

  return logger;
}

export function createAppLogger<T extends LoggerLike>(baseLogger: T): T {
  return applyLogRedaction(baseLogger);
}
