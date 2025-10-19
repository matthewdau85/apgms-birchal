import crypto from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { authTokenSchema, type AuthTokenClaims } from "../schemas/auth";
import { fastifyPlugin } from "../utils/fastify-plugin";

type VerifyFn = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module "fastify" {
  interface FastifyInstance {
    verifyAuthorization: VerifyFn;
  }

  interface FastifyRequest {
    user?: AuthTokenClaims;
    orgId?: string;
  }
}

type JsonWebKeySet = {
  keys?: JsonWebKey[];
};

type DecodedJwt = {
  header: Record<string, any>;
  payload: Record<string, any>;
  signature: Buffer;
  signingInput: string;
};

const base64UrlDecode = (segment: string): Buffer => {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4;
  const padded = normalized + (padLength === 0 ? "" : "=".repeat(4 - padLength));
  return Buffer.from(padded, "base64");
};

const decodeJwt = (token: string): DecodedJwt => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token");
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  try {
    const headerJson = base64UrlDecode(headerSegment).toString("utf8");
    const payloadJson = base64UrlDecode(payloadSegment).toString("utf8");
    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);
    const signature = base64UrlDecode(signatureSegment);
    if (signature.length === 0) {
      throw new Error("empty_signature");
    }
    return {
      header,
      payload,
      signature,
      signingInput: `${headerSegment}.${payloadSegment}`,
    };
  } catch (err) {
    throw new Error(`invalid_token: ${(err as Error).message}`);
  }
};

const verifyHs256 = (decoded: DecodedJwt, secret: string) => {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(decoded.signingInput);
  const expected = hmac.digest();
  if (expected.length !== decoded.signature.length) {
    throw new Error("invalid_signature");
  }
  if (!crypto.timingSafeEqual(expected, decoded.signature)) {
    throw new Error("invalid_signature");
  }
};

const algorithmMap: Record<string, string> = {
  RS256: "RSA-SHA256",
  RS384: "RSA-SHA384",
  RS512: "RSA-SHA512",
};

const jwkCache: { url?: string; keys?: JsonWebKey[]; fetchedAt?: number } = {};

const fetchRemoteKeys = async (jwksUrl: string): Promise<JsonWebKey[]> => {
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch JWKS (${response.status})`);
  }
  const json = (await response.json()) as JsonWebKeySet;
  if (!json.keys || !Array.isArray(json.keys)) {
    throw new Error("JWKS missing keys array");
  }
  jwkCache.url = jwksUrl;
  jwkCache.keys = json.keys;
  jwkCache.fetchedAt = Date.now();
  return json.keys;
};

const getRemoteKey = async (jwksUrl: string, kid?: string): Promise<JsonWebKey> => {
  const cachedKeys = jwkCache.url === jwksUrl ? jwkCache.keys : undefined;
  const keys = cachedKeys ?? (await fetchRemoteKeys(jwksUrl));
  let key = keys.find((candidate) => (!kid ? true : candidate.kid === kid));
  if (!key) {
    const freshKeys = await fetchRemoteKeys(jwksUrl);
    key = freshKeys.find((candidate) => (!kid ? true : candidate.kid === kid));
  }
  if (!key) {
    throw new Error("Unable to locate signing key");
  }
  return key;
};

const verifyWithRemoteKey = async (decoded: DecodedJwt, jwksUrl: string) => {
  const alg = decoded.header?.alg as string | undefined;
  if (!alg) {
    throw new Error("missing_alg");
  }
  const mapped = algorithmMap[alg];
  if (!mapped) {
    throw new Error(`unsupported_algorithm:${alg}`);
  }
  const jwk = await getRemoteKey(jwksUrl, decoded.header?.kid as string | undefined);
  const keyObject = crypto.createPublicKey({ format: "jwk", key: jwk });
  const verified = crypto.verify(mapped, Buffer.from(decoded.signingInput), keyObject, decoded.signature);
  if (!verified) {
    throw new Error("invalid_signature");
  }
};

const authCore: FastifyPluginAsync = async (fastify) => {
  const devSecret = process.env.DEV_JWT_SECRET;
  const issuer = process.env.OIDC_ISSUER;
  const jwksUrl = process.env.OIDC_JWKS_URL;

  const verifyAuthorization: VerifyFn = async (request, reply) => {
    const respondUnauthorized = () => {
      if (!reply.sent) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      return reply;
    };

    const header = request.headers.authorization;
    if (!header || typeof header !== "string" || !header.toLowerCase().startsWith("bearer ")) {
      return respondUnauthorized();
    }

    const token = header.slice(7).trim();
    if (!token) {
      return respondUnauthorized();
    }

    try {
      const decoded = decodeJwt(token);
      if (issuer && decoded.payload?.iss && decoded.payload.iss !== issuer) {
        throw new Error("issuer_mismatch");
      }

      if (process.env.NODE_ENV === "production") {
        if (!jwksUrl) {
          throw new Error("OIDC_JWKS_URL not configured");
        }
        await verifyWithRemoteKey(decoded, jwksUrl);
      } else {
        if (!devSecret) {
          throw new Error("DEV_JWT_SECRET not configured");
        }
        if (decoded.header?.alg !== "HS256") {
          throw new Error("invalid_algorithm");
        }
        verifyHs256(decoded, devSecret);
      }

      const parsed = authTokenSchema.safeParse(decoded.payload);
      if (!parsed.success) {
        return respondUnauthorized();
      }

      request.user = parsed.data;
      request.orgId = parsed.data.orgId;
    } catch (err) {
      request.log.error({ err }, "authorization failed");
      return respondUnauthorized();
    }
  };

  fastify.decorate<VerifyFn>("verifyAuthorization", verifyAuthorization);
};

const authPlugin = fastifyPlugin(authCore);

export default authPlugin;
