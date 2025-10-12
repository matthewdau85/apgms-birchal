import { createHmac, randomUUID, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';

type SupportedAlgorithm = 'HS256' | 'HS384' | 'HS512';

const algorithmMap: Record<SupportedAlgorithm, string> = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
};

export interface JwtConfig {
  issuer: string;
  audience: string | string[];
  accessTokenTtl: string | number;
  refreshTokenTtl: string | number;
  clockSkewInSeconds?: number;
}

export type AdditionalClaims = Record<string, unknown>;

export interface JwtSecrets {
  access: string | Uint8Array;
  refresh: string | Uint8Array;
  algorithm?: SupportedAlgorithm;
}

export interface IssueTokensOptions {
  subject: string;
  claims?: AdditionalClaims;
  accessJti?: string;
  refreshJti?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessJti: string;
  refreshJti: string;
}

export interface RotateTokensOptions {
  refreshToken: string;
  expectedRefreshJti?: string;
  subject?: string;
  claims?: AdditionalClaims;
  accessJti?: string;
  refreshJti?: string;
}

interface JwtHeader {
  alg: SupportedAlgorithm;
  typ: 'JWT';
}

interface VerificationResult {
  header: JwtHeader;
  payload: Record<string, any>;
}

function base64urlEncode(input: string | Buffer): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString('base64')
    .replace(/=+$/u, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');
}

function base64urlDecode(input: string): Buffer {
  const normalized = input.replace(/-/gu, '+').replace(/_/gu, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function toBuffer(secret: string | Uint8Array): Buffer {
  return Buffer.isBuffer(secret) ? secret : Buffer.from(secret);
}

function durationToSeconds(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  const match = /^([0-9]+)([smhd])$/iu.exec(value.trim());

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 60 * 60 * 24;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

function normalizeAudience(audience: string | string[]): string[] {
  return Array.isArray(audience) ? audience : [audience];
}

function filterClaims(claims?: AdditionalClaims): AdditionalClaims {
  if (!claims) {
    return {};
  }

  const reserved = new Set(['iss', 'aud', 'exp', 'nbf', 'iat', 'jti', 'sub']);

  return Object.entries(claims).reduce<AdditionalClaims>((acc, [key, value]) => {
    if (!reserved.has(key)) {
      acc[key] = value;
    }

    return acc;
  }, {});
}

function createPayload(
  config: JwtConfig,
  subject: string,
  ttl: string | number,
  jti: string,
  claims?: AdditionalClaims,
): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = now + durationToSeconds(ttl);

  return {
    iss: config.issuer,
    aud: config.audience,
    sub: subject,
    iat: now,
    exp: expiresIn,
    jti,
    ...filterClaims(claims),
  };
}

function signToken(
  payload: Record<string, unknown>,
  algorithm: SupportedAlgorithm,
  secret: string | Uint8Array,
): string {
  const header: JwtHeader = { alg: algorithm, typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const hash = algorithmMap[algorithm];
  const signature = createHmac(hash, toBuffer(secret)).update(data).digest();
  return `${data}.${base64urlEncode(signature)}`;
}

function assertAudience(aud: unknown, expected: string[]): void {
  if (Array.isArray(aud)) {
    const hasIntersection = aud.some((value) => expected.includes(value));
    if (!hasIntersection) {
      throw new Error('Audience mismatch');
    }
    return;
  }

  if (typeof aud === 'string') {
    if (!expected.includes(aud)) {
      throw new Error('Audience mismatch');
    }
    return;
  }

  throw new Error('Invalid token audience');
}

function verifyToken(
  token: string,
  secret: string | Uint8Array,
  config: JwtConfig,
  algorithm: SupportedAlgorithm,
): VerificationResult {
  const segments = token.split('.');

  if (segments.length !== 3) {
    throw new Error('Invalid token structure');
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const data = `${encodedHeader}.${encodedPayload}`;
  const hash = algorithmMap[algorithm];
  const expectedSignature = base64urlEncode(createHmac(hash, toBuffer(secret)).update(data).digest());

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error('Token signature mismatch');
  }

  const header = JSON.parse(base64urlDecode(encodedHeader).toString('utf8')) as JwtHeader;

  if (header.alg !== algorithm) {
    throw new Error('Unexpected signing algorithm');
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload).toString('utf8')) as Record<string, any>;
  const now = Math.floor(Date.now() / 1000);
  const tolerance = config.clockSkewInSeconds ?? 0;

  if (payload.iss !== config.issuer) {
    throw new Error('Issuer mismatch');
  }

  assertAudience(payload.aud, normalizeAudience(config.audience));

  if (typeof payload.exp === 'number' && now - tolerance >= payload.exp) {
    throw new Error('Token expired');
  }

  if (typeof payload.nbf === 'number' && now + tolerance < payload.nbf) {
    throw new Error('Token not yet valid');
  }

  return { header, payload };
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return nodeTimingSafeEqual(aBuffer, bBuffer);
}

function resolveAlgorithm(secrets: JwtSecrets): SupportedAlgorithm {
  return secrets.algorithm ?? 'HS256';
}

export async function issueTokens(
  config: JwtConfig,
  secrets: JwtSecrets,
  options: IssueTokensOptions,
): Promise<IssuedTokens> {
  const algorithm = resolveAlgorithm(secrets);
  const accessJti = options.accessJti ?? randomUUID();
  const refreshJti = options.refreshJti ?? randomUUID();

  const accessPayload = createPayload(config, options.subject, config.accessTokenTtl, accessJti, options.claims);
  const refreshPayload = createPayload(config, options.subject, config.refreshTokenTtl, refreshJti, options.claims);

  return {
    accessToken: signToken(accessPayload, algorithm, secrets.access),
    refreshToken: signToken(refreshPayload, algorithm, secrets.refresh),
    accessJti,
    refreshJti,
  };
}

export async function verifyAccessToken(token: string, config: JwtConfig, secrets: JwtSecrets) {
  const algorithm = resolveAlgorithm(secrets);
  return verifyToken(token, secrets.access, config, algorithm);
}

export async function verifyRefreshToken(token: string, config: JwtConfig, secrets: JwtSecrets) {
  const algorithm = resolveAlgorithm(secrets);
  return verifyToken(token, secrets.refresh, config, algorithm);
}

export async function rotateTokens(
  config: JwtConfig,
  secrets: JwtSecrets,
  options: RotateTokensOptions,
): Promise<IssuedTokens> {
  const verification = await verifyRefreshToken(options.refreshToken, config, secrets);
  const currentJti = verification.payload.jti;

  if (options.expectedRefreshJti && currentJti !== options.expectedRefreshJti) {
    throw new Error('Refresh token identifier mismatch');
  }

  const subject = options.subject ?? verification.payload.sub;

  if (!subject || typeof subject !== 'string') {
    throw new Error('Refresh token subject missing');
  }

  return issueTokens(config, secrets, {
    subject,
    claims: options.claims,
    accessJti: options.accessJti,
    refreshJti: options.refreshJti,
  });
}
