import crypto from "node:crypto";

type JwtHeader = {
  alg: string;
  typ: string;
};

type JwtPayload = Record<string, any>;

function base64UrlDecode(segment: string): Buffer {
  segment = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = segment.length % 4;
  if (pad) {
    segment += "=".repeat(4 - pad);
  }
  return Buffer.from(segment, "base64");
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function verifyJwt(token: string | undefined, secret: string): JwtPayload | null {
  if (!token) {
    return null;
  }
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }
  const [headerSeg, payloadSeg, signatureSeg] = segments;
  try {
    const header = JSON.parse(base64UrlDecode(headerSeg).toString("utf8")) as JwtHeader;
    if (header.alg !== "HS256") {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(payloadSeg).toString("utf8")) as JwtPayload;
    const expected = base64UrlEncode(
      crypto.createHmac("sha256", secret).update(`${headerSeg}.${payloadSeg}`).digest()
    );
    if (!crypto.timingSafeEqual(Buffer.from(signatureSeg), Buffer.from(expected))) {
      return null;
    }
    const exp = payload.exp as number | undefined;
    if (exp && exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export function signJwt(payload: JwtPayload, secret: string, options?: { header?: Partial<JwtHeader> }) {
  const header: JwtHeader = { alg: "HS256", typ: "JWT", ...(options?.header ?? {}) };
  const headerSeg = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadSeg = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = crypto.createHmac("sha256", secret).update(`${headerSeg}.${payloadSeg}`).digest();
  const signatureSeg = base64UrlEncode(signature);
  return `${headerSeg}.${payloadSeg}.${signatureSeg}`;
}
