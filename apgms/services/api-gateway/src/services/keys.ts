import { randomBytes } from "node:crypto";

export interface Signer {
  alias: string;
  version: number;
  publicKey: string;
}

const store = new Map<string, Signer>();

const createPublicKey = (): string => randomBytes(32).toString("base64url");

export const rotateKey = async (alias: string): Promise<Signer> => {
  const current = store.get(alias);
  const nextVersion = (current?.version ?? 0) + 1;
  const signer: Signer = {
    alias,
    version: nextVersion,
    publicKey: createPublicKey(),
  };

  store.set(alias, signer);
  return signer;
};

export const getSigner = async (alias: string): Promise<Signer | undefined> => {
  return store.get(alias);
};
