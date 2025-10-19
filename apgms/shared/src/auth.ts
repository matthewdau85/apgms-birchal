import { createSecretKey } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "./db";

export interface AccessTokenVerifierConfig {
  issuer?: string;
  audience?: string;
  mfaClaim?: string;
  jwksUrl?: string;
  sharedSecret?: string;
  allowedClockSkewSeconds?: number;
}

export interface AuthContext {
  tokenId?: string;
  userId: string;
  email: string;
  orgId: string;
  roles: Set<string>;
  scopes: Set<string>;
  authenticationMethods: string[];
}

class AuthenticationError extends Error {
  public readonly statusCode: number;
  public readonly reason: string;

  constructor(reason: string, statusCode = 401) {
    super(reason);
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

const parseStringClaim = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const parseStringArrayClaim = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return undefined;
};

const resolveUser = async (payload: JWTPayload) => {
  const subject = parseStringClaim(payload.sub);
  const email = parseStringClaim(payload.email);

  if (!subject && !email) {
    throw new AuthenticationError("token missing subject/email");
  }

  const user = subject
    ? await prisma.user.findUnique({ where: { id: subject } })
    : await prisma.user.findUnique({ where: { email: email! } });

  if (!user) {
    throw new AuthenticationError("user_not_found", 403);
  }

  return user;
};

export const createAccessTokenVerifier = (config: AccessTokenVerifierConfig) => {
  const { jwksUrl, sharedSecret, issuer, audience, mfaClaim = "mfa" } = config;

  if (!jwksUrl && !sharedSecret) {
    throw new Error("Authentication is not configured. Provide JWKS or shared secret.");
  }

  const keyLike = sharedSecret ? createSecretKey(Buffer.from(sharedSecret, "utf8")) : undefined;
  const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : undefined;

  return async (token: string): Promise<AuthContext> => {
    let payload: JWTPayload;

    try {
      if (jwks) {
        ({ payload } = await jwtVerify(token, jwks, {
          issuer,
          audience,
          clockTolerance: config.allowedClockSkewSeconds,
        }));
      } else {
        ({ payload } = await jwtVerify(token, keyLike!, {
          issuer,
          audience,
          clockTolerance: config.allowedClockSkewSeconds,
        }));
      }
    } catch (error) {
      throw new AuthenticationError("invalid_token");
    }

    const amr = parseStringArrayClaim(payload.amr) ?? [];
    if (!amr.includes(mfaClaim)) {
      throw new AuthenticationError("mfa_required", 403);
    }

    const user = await resolveUser(payload);
    const orgClaim =
      parseStringClaim(payload.orgId) ??
      parseStringClaim((payload as Record<string, unknown>).org);
    if (orgClaim && orgClaim !== user.orgId) {
      throw new AuthenticationError("org_mismatch", 403);
    }

    const roles = new Set(
      parseStringArrayClaim((payload as Record<string, unknown>).roles) ?? []
    );
    const scopes = new Set(parseStringArrayClaim(payload.scope) ?? []);
    const email = parseStringClaim(payload.email) ?? user.email;

    return {
      tokenId: parseStringClaim(payload.jti),
      userId: user.id,
      email,
      orgId: user.orgId,
      roles,
      scopes,
      authenticationMethods: amr,
    };
  };
};

export { AuthenticationError };
