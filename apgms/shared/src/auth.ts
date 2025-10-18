import type { IncomingHttpHeaders } from "node:http";

export interface AuthenticatedPrincipal {
  tokenId: string;
  subject: string;
  orgId: string;
  roles: string[];
}

export type AuthResult =
  | { ok: true; principal: AuthenticatedPrincipal }
  | { ok: false; error: string; status?: number };

export interface Authenticator {
  verify(headers: IncomingHttpHeaders): AuthResult;
}

export interface StaticTokenConfig {
  token: string;
  principal: AuthenticatedPrincipal;
  aliases?: string[];
}

function normalizeToken(token?: string | string[]) {
  if (!token) return undefined;
  if (Array.isArray(token)) {
    return token.find((entry) => !!entry)?.trim();
  }
  return token.trim();
}

function extractToken(headers: IncomingHttpHeaders) {
  const authorization = normalizeToken(headers.authorization);
  if (authorization) {
    const [scheme, value] = authorization.split(/\s+/);
    if (scheme?.toLowerCase() === "bearer" && value) {
      return value.trim();
    }
    if (!value) {
      return scheme?.trim();
    }
  }

  const apiKey = normalizeToken(headers["x-api-key"]);
  if (apiKey) {
    return apiKey;
  }

  return undefined;
}

export class StaticTokenAuthenticator implements Authenticator {
  private readonly tokenMap: Map<string, AuthenticatedPrincipal>;

  constructor(config: StaticTokenConfig | StaticTokenConfig[]) {
    const configs = Array.isArray(config) ? config : [config];
    this.tokenMap = new Map();
    for (const entry of configs) {
      const aliases = new Set([entry.token, ...(entry.aliases ?? [])]);
      for (const alias of aliases) {
        this.tokenMap.set(alias, entry.principal);
      }
    }
  }

  verify(headers: IncomingHttpHeaders): AuthResult {
    const token = extractToken(headers);
    if (!token) {
      return { ok: false, status: 401, error: "missing_token" };
    }
    const principal = this.tokenMap.get(token);
    if (!principal) {
      return { ok: false, status: 401, error: "invalid_token" };
    }
    return { ok: true, principal };
  }
}

export function createDefaultAuthenticator(): StaticTokenAuthenticator {
  const token = process.env.API_GATEWAY_TOKEN ?? "local-test-token";
  return new StaticTokenAuthenticator({
    token,
    principal: {
      tokenId: "default",
      subject: "system",
      orgId: "default-org",
      roles: ["finance:read", "finance:write", "audit:read"],
    },
  });
}
