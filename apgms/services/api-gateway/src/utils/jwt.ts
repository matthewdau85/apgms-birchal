import crypto from "node:crypto";

type TokenType = "access" | "refresh";

export interface JwtClaims {
  sub: string;
  orgId: string;
  roles: string[];
  tokenType: TokenType;
  iss: string;
  iat: number;
  exp: number;
}

interface SignOptions {
  secret: string;
  issuer: string;
  expiresInSeconds: number;
  tokenType: TokenType;
}

const base64UrlEncode = (input: string | Buffer | Uint8Array) =>
  Buffer.from(input).toString("base64url");

const base64UrlDecode = (input: string) => Buffer.from(input, "base64url").toString("utf8");

export const signJwt = (
  claims: Pick<JwtClaims, "sub" | "orgId" | "roles">,
  options: SignOptions,
): string => {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = {
    sub: claims.sub,
    orgId: claims.orgId,
    roles: claims.roles,
    iss: options.issuer,
    iat: issuedAt,
    exp: issuedAt + Math.max(options.expiresInSeconds, 1),
    tokenType: options.tokenType,
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${payloadEncoded}`;
  const signature = crypto
    .createHmac("sha256", options.secret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
};

export const verifyJwt = (token: string, secret: string): JwtClaims => {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("invalid_token");
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actualBuffer.length !== expectedBuffer.length) {
    throw new Error("invalid_signature");
  }
  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("invalid_signature");
  }

  const payloadJson = base64UrlDecode(encodedPayload);
  const payload = JSON.parse(payloadJson) as JwtClaims;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("token_expired");
  }

  return payload;
};

export const isAccessToken = (claims: JwtClaims): boolean => claims.tokenType === "access";

export const isRefreshToken = (claims: JwtClaims): boolean => claims.tokenType === "refresh";
