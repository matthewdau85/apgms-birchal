import { createHmac, timingSafeEqual } from "node:crypto";
import { FastifyReply, FastifyRequest } from "fastify";

type JwtPayload = {
  sub?: string;
  orgId?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
};

function base64UrlDecode(segment: string) {
  return Buffer.from(segment, "base64url").toString("utf8");
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be configured");
  }
  return secret;
}

function parseJwt(token: string): { header: Record<string, unknown>; payload: JwtPayload; signature: string; raw: string } {
  const [headerSegment, payloadSegment, signatureSegment] = token.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new Error("invalid_token_structure");
  }
  const header = JSON.parse(base64UrlDecode(headerSegment)) as Record<string, unknown>;
  const payload = JSON.parse(base64UrlDecode(payloadSegment)) as JwtPayload;
  return {
    header,
    payload,
    signature: signatureSegment,
    raw: `${headerSegment}.${payloadSegment}`,
  };
}

function assertPayload(payload: JwtPayload) {
  if (!payload.sub) {
    throw new Error("JWT payload missing subject");
  }
  if (!payload.orgId) {
    throw new Error("JWT payload missing orgId");
  }
  const issuer = process.env.JWT_ISS;
  if (issuer && payload.iss !== issuer) {
    throw new Error("invalid_issuer");
  }
  const audience = process.env.JWT_AUD;
  if (audience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(audience)) {
      throw new Error("invalid_audience");
    }
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new Error("token_expired");
  }
  if (payload.nbf && Date.now() / 1000 < payload.nbf) {
    throw new Error("token_not_ready");
  }
  return { userId: payload.sub, orgId: payload.orgId };
}

function verifyJwt(token: string) {
  const { header, payload, signature, raw } = parseJwt(token);
  if (header.alg !== "HS256") {
    throw new Error("unsupported_algorithm");
  }
  const expected = createHmac("sha256", getJwtSecret())
    .update(raw)
    .digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(signature);
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new Error("invalid_signature");
  }
  return assertPayload(payload);
}

function resolveDevIdentity(req: FastifyRequest) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const user = req.headers["x-apgms-dev-user"];
  const org = req.headers["x-apgms-dev-org"];
  if (typeof user === "string" && typeof org === "string") {
    return { userId: user, orgId: org };
  }
  return null;
}

export async function authenticateRequest(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    try {
      const { userId, orgId } = verifyJwt(token);
      req.userId = userId;
      req.orgId = orgId;
      return;
    } catch (err) {
      req.log.warn({ err }, "failed to verify jwt");
      return reply.code(401).send({ error: "unauthorized" });
    }
  }

  const devIdentity = resolveDevIdentity(req);
  if (devIdentity) {
    req.userId = devIdentity.userId;
    req.orgId = devIdentity.orgId;
    return;
  }

  return reply.code(401).send({ error: "unauthorized" });
}
