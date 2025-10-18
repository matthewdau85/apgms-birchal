import { createHash, generateKeyPairSync, KeyObject, sign as signData, verify as verifySignature } from 'node:crypto';

export function sha256(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return createHash('sha256').update(buffer).digest('hex');
}

type Ed25519KeyPair = {
  privateKey: KeyObject;
  publicKey: KeyObject;
};

let keyPair: Ed25519KeyPair | undefined;

function getKeyPair(): Ed25519KeyPair {
  if (!keyPair) {
    const generated = generateKeyPairSync('ed25519');
    keyPair = {
      privateKey: generated.privateKey,
      publicKey: generated.publicKey,
    };
  }
  return keyPair;
}

export interface KmsLike {
  sign(payload: Uint8Array): string;
  verify(payload: Uint8Array, signatureB64: string): boolean;
}

export const devKmsLike: KmsLike = {
  sign(payload: Uint8Array): string {
    const { privateKey } = getKeyPair();
    const signature = signData(null, Buffer.from(payload), privateKey);
    return signature.toString('base64');
  },
  verify(payload: Uint8Array, signatureB64: string): boolean {
    const { publicKey } = getKeyPair();
    const signature = Buffer.from(signatureB64, 'base64');
    return verifySignature(null, Buffer.from(payload), publicKey, signature);
  },
};
