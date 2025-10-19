import {
  clearSignerCache,
  getSigner,
  type JWTPayload,
  type JwtVerifyResult,
  type SignJwtOptions,
  type Signer,
  type VerifyJwtOptions,
} from "@apgms/shared";

let signerPromise: Promise<Signer> | null = null;

async function loadSigner(): Promise<Signer> {
  if (!signerPromise) {
    signerPromise = getSigner("rpt");
  }
  return signerPromise;
}

export interface MintRptOptions extends SignJwtOptions {}

export async function mintRpt<T extends JWTPayload>(payload: T, options?: MintRptOptions): Promise<string> {
  const signer = await loadSigner();
  return signer.sign(payload, options);
}

export async function verifyRpt<T extends JWTPayload>(token: string, options?: VerifyJwtOptions): Promise<JwtVerifyResult<T>> {
  const signer = await loadSigner();
  return signer.verify<T>(token, options);
}

export function resetRptSignerCache() {
  signerPromise = null;
  clearSignerCache("rpt");
}
