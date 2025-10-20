import crypto from "node:crypto";

const DEV_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIDvwJ0fBbHktHEOugMrn2gFG/no6r3dYxRq5Szjp9U0D
-----END PRIVATE KEY-----\n`;

const DEV_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAjXMO786lCq6uVtA0tUELMMt/Ju9ix6EvbxuNaz+tDZY=
-----END PUBLIC KEY-----\n`;

export interface SignatureArtifacts {
  digestHex: string;
  digestBase64: string;
  signature: Buffer;
  signatureBase64: string;
  publicKeyPem: string;
}

export function digestCanonicalUserMessage(canonicalUserMessage: string): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(canonicalUserMessage, "utf8");
  return hash.digest();
}

export function signCanonicalUserMessage(canonicalUserMessage: string): SignatureArtifacts {
  const digest = digestCanonicalUserMessage(canonicalUserMessage);
  const privateKey = crypto.createPrivateKey({ key: DEV_PRIVATE_KEY, format: "pem" });
  const signature = crypto.sign(null, digest, privateKey);

  return {
    digestHex: digest.toString("hex"),
    digestBase64: digest.toString("base64"),
    signature,
    signatureBase64: signature.toString("base64"),
    publicKeyPem: DEV_PUBLIC_KEY,
  };
}

export function verifySignatureFromDigest(digestHex: string, signature: Buffer): boolean {
  const publicKey = crypto.createPublicKey({ key: DEV_PUBLIC_KEY, format: "pem" });
  const digestBuffer = Buffer.from(digestHex, "hex");
  return crypto.verify(null, digestBuffer, publicKey, signature);
}
