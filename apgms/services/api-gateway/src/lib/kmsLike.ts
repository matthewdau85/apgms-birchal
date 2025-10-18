import { generateKeyPairSync, sign as edSign, verify as edVerify } from "node:crypto";

export type KmsLikeBytes = Uint8Array | Buffer | string;

const kmsLike = (() => {
  let keyPair: ReturnType<typeof generateKeyPairSync> | null = null;

  const getKeyPair = () => {
    if (!keyPair) {
      keyPair = generateKeyPairSync("ed25519");
    }
    return keyPair;
  };

  const toBuffer = (value: KmsLikeBytes | Buffer): Buffer => {
    if (typeof value === "string") {
      return Buffer.from(value, "utf-8");
    }
    if (Buffer.isBuffer(value)) {
      return value;
    }
    return Buffer.from(value);
  };

  return {
    sign(data: KmsLikeBytes): string {
      const { privateKey } = getKeyPair();
      const buffer = toBuffer(data);
      return edSign(null, buffer, privateKey).toString("base64");
    },
    verify(data: KmsLikeBytes, signature: string | Uint8Array | Buffer): boolean {
      const { publicKey } = getKeyPair();
      const buffer = toBuffer(data);
      const signatureBuffer = typeof signature === "string" ? Buffer.from(signature, "base64") : toBuffer(signature);
      return edVerify(null, buffer, publicKey, signatureBuffer);
    },
    pubkey(): string {
      const { publicKey } = getKeyPair();
      return publicKey.export({ format: "der", type: "spki" }).toString("base64");
    },
  };
})();

export type KmsLike = typeof kmsLike;

export { kmsLike };
