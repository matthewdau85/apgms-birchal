import type { ThemeTokens } from './tokens';
import { themeTokens } from './tokens';

type FlatTokenMap = Record<string, string | number>;
type TokenRecord = Record<string, unknown>;

const VARIABLE_PREFIX = '--apgms';

const toCssVarName = (segments: string[]) => [VARIABLE_PREFIX, ...segments].join('-');

const isPlainObject = (value: unknown): value is TokenRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const flattenTokens = (tokens: TokenRecord, path: string[] = []): FlatTokenMap => {
  const entries: FlatTokenMap = {};

  Object.entries(tokens).forEach(([key, value]) => {
    const normalizedKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    const nextPath = [...path, normalizedKey];

    if (isPlainObject(value)) {
      Object.assign(entries, flattenTokens(value, nextPath));
      return;
    }

    entries[toCssVarName(nextPath)] = String(value);
  });

  return entries;
};

const mergeTokens = (base: TokenRecord, overrides?: TokenRecord): TokenRecord => {
  if (!overrides) {
    return { ...base };
  }

  return Object.entries(base).reduce<TokenRecord>((acc, [key, value]) => {
    if (isPlainObject(value)) {
      acc[key] = mergeTokens(value, isPlainObject(overrides[key]) ? (overrides[key] as TokenRecord) : undefined);
      return acc;
    }

    acc[key] = value;
    return acc;
  }, { ...overrides });
};

export const themeVariableMap = flattenTokens(themeTokens as TokenRecord);

export const themeCssText = `:root {\n${Object.entries(themeVariableMap)
  .map(([name, value]) => `  ${name}: ${value};`)
  .join('\n')}\n}`;

export const injectThemeStyles = (doc: Document = document) => {
  const existing = doc.getElementById('apgms-theme');
  if (existing) {
    existing.textContent = themeCssText;
    return existing as HTMLStyleElement;
  }

  const style = doc.createElement('style');
  style.id = 'apgms-theme';
  style.textContent = themeCssText;
  doc.head.appendChild(style);
  return style;
};

export const applyTheme = (
  target: HTMLElement = document.documentElement,
  tokens: Partial<ThemeTokens> = {},
) => {
  const merged = mergeTokens(themeTokens as TokenRecord, tokens as TokenRecord);
  const resolved = flattenTokens(merged);
  Object.entries(resolved).forEach(([name, value]) => {
    target.style.setProperty(name, String(value));
  });

  return target;
};

export { themeTokens };
