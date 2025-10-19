import assert from "node:assert/strict";
import { createSign, createVerify, generateKeyPairSync } from "node:crypto";
import test from "node:test";

function generateRsaKeyPairPem() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

function createJwtLikeToken(payload: Record<string, unknown>, privateKeyPem: string) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const message = `${header}.${body}`;

  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();

  const signature = signer.sign(privateKeyPem).toString("base64url");
  return `${message}.${signature}`;
}

function verifyJwtLikeToken(token: string, publicKeyPem: string) {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("token is not a valid JWT structure");
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = segments;
  const message = `${headerEncoded}.${payloadEncoded}`;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();

  const signature = Buffer.from(signatureEncoded, "base64url");
  const verified = verifier.verify(publicKeyPem, signature);
  if (!verified) {
    throw new Error("signature verification failed");
  }

  return JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf8"));
}

test("rotated JWT keys invalidate existing tokens", () => {
  const firstPair = generateRsaKeyPairPem();
  const secondPair = generateRsaKeyPairPem();

  assert.notStrictEqual(firstPair.privateKeyPem, secondPair.privateKeyPem);
  assert.notStrictEqual(firstPair.publicKeyPem, secondPair.publicKeyPem);

  const payload = { sub: "user-123", aud: "apgms-clients", iss: "https://auth.local.dev/" };

  const token = createJwtLikeToken(payload, firstPair.privateKeyPem);

  const decoded = verifyJwtLikeToken(token, firstPair.publicKeyPem);
  assert.equal(decoded.sub, payload.sub);

  assert.throws(() => verifyJwtLikeToken(token, secondPair.publicKeyPem), /signature verification failed/);

  const rotatedToken = createJwtLikeToken(payload, secondPair.privateKeyPem);
  const rotatedDecoded = verifyJwtLikeToken(rotatedToken, secondPair.publicKeyPem);
  assert.equal(rotatedDecoded.sub, payload.sub);
});
