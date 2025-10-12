import { randomBytes, timingSafeEqual } from 'node:crypto';

export interface CsrfOptions {
  enabled?: boolean;
  cookieName?: string;
  headerName?: string;
  tokenLength?: number;
  cookieAttributes?: Record<string, string | number | boolean>;
}

export interface IssuedCsrfToken {
  token: string;
  cookie: {
    name: string;
    value: string;
    attributes: Record<string, string | number | boolean>;
  };
  headerName: string;
}

const defaultCookieName = 'csrf-token';
const defaultHeaderName = 'x-csrf-token';
const defaultTokenLength = 32;

function generateToken(length: number): string {
  return randomBytes(length).toString('base64url');
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface CsrfHelper {
  issue(): IssuedCsrfToken | null;
  verify(cookieToken?: string, headerToken?: string): boolean;
  isEnabled(): boolean;
}

export function createCsrfHelper(options?: CsrfOptions): CsrfHelper {
  const enabled = options?.enabled ?? true;
  const cookieName = options?.cookieName ?? defaultCookieName;
  const headerName = options?.headerName ?? defaultHeaderName;
  const tokenLength = options?.tokenLength ?? defaultTokenLength;
  const cookieAttributes = options?.cookieAttributes ?? {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  };

  return {
    issue(): IssuedCsrfToken | null {
      if (!enabled) {
        return null;
      }

      const token = generateToken(tokenLength);

      return {
        token,
        headerName,
        cookie: {
          name: cookieName,
          value: token,
          attributes: cookieAttributes,
        },
      };
    },
    verify(cookieToken?: string, headerToken?: string): boolean {
      if (!enabled) {
        return true;
      }

      if (!cookieToken || !headerToken) {
        return false;
      }

      try {
        return safeCompare(cookieToken, headerToken);
      } catch (error) {
        return false;
      }
    },
    isEnabled(): boolean {
      return enabled;
    },
  };
}
