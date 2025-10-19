const WILDCARD = "*";

type CorsCallback = (err: Error | null, allow?: boolean) => void;
export type OriginValidator = (origin: string | undefined, cb: CorsCallback) => void;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parseAllowedOrigins = (envValue?: string): string[] => {
  if (!envValue) {
    return [];
  }

  return envValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const compileWildcard = (pattern: string): RegExp => {
  const escaped = escapeRegExp(pattern);
  const regexSource = `^${escaped.replace(/\\\*/g, ".*")}$`;
  return new RegExp(regexSource);
};

export const buildCorsOriginValidator = (envValue?: string): OriginValidator => {
  const allowedOrigins = parseAllowedOrigins(envValue);
  const allowAll = allowedOrigins.includes(WILDCARD);
  const exactMatches = new Set(allowedOrigins.filter((origin) => !origin.includes("*")));
  const wildcardMatchers = allowedOrigins
    .filter((origin) => !exactMatches.has(origin) && origin.includes("*"))
    .map((origin) => compileWildcard(origin));

  return (origin: string | undefined, cb: CorsCallback) => {
    if (!origin) {
      cb(null, true);
      return;
    }

    if (allowAll || exactMatches.has(origin) || wildcardMatchers.some((regex) => regex.test(origin))) {
      cb(null, true);
      return;
    }

    cb(new Error("Origin not allowed"), false);
  };
};
