import { getRptKeyPair } from "../../security/rpt";

export interface ServerSecurityConfig {
  readonly rpt: {
    readonly algorithm: "EdDSA";
    readonly keyId: string;
    readonly publicKey: string;
  };
}

export interface ServerConfig {
  readonly security: ServerSecurityConfig;
}

const rptKeyPair = getRptKeyPair();

export const serverConfig: ServerConfig = {
  security: {
    rpt: {
      algorithm: rptKeyPair.algorithm,
      keyId: rptKeyPair.keyId,
      publicKey: rptKeyPair.publicKey,
    },
  },
};

export function getRptPublicKey(): string {
  return serverConfig.security.rpt.publicKey;
}
