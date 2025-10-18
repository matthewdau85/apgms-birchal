import { BinaryLike, createHash, createPrivateKey, createPublicKey, KeyObject } from "node:crypto";

export function sha256(input: BinaryLike): string {
  return createHash("sha256").update(input).digest("hex");
}

const DEV_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEICMuVTigqBw+aon4aPjcNVOVnQ5V33jZK3u6YpMRP8uo\n-----END PRIVATE KEY-----\n`;
const DEV_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAsB+2iIV6EVetXRmiL2epFkkupbLlU8wHRtQQXhNlnhE=\n-----END PUBLIC KEY-----\n`;

let cachedKeypair: { privateKey: KeyObject; publicKey: KeyObject } | null = null;

export function getDevEd25519Keypair(): { privateKey: KeyObject; publicKey: KeyObject } {
  if (!cachedKeypair) {
    cachedKeypair = {
      privateKey: createPrivateKey({ key: DEV_PRIVATE_KEY_PEM, format: "pem" }),
      publicKey: createPublicKey({ key: DEV_PUBLIC_KEY_PEM, format: "pem" }),
    };
  }
  return cachedKeypair;
}
