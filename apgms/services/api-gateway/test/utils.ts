import { createHmac } from "node:crypto";

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export async function createJwt(orgId: string, userId = "user_123") {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    orgId,
    sub: userId,
    iss: process.env.JWT_ISS,
    aud: process.env.JWT_AUD,
    iat: issuedAt,
    exp: issuedAt + 60 * 60,
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", process.env.JWT_SECRET ?? "test-secret")
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export const TEST_ORG_ID = "ckorg1test00000000000001";

export function fakeDecimal(value: number) {
  return {
    toString: () => value.toString(),
    valueOf: () => value,
  };
}
