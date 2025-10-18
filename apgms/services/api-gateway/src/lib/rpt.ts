import { createHmac, randomUUID } from "node:crypto";
import type { AllocationItem } from "./allocations";

export interface RptPayload {
  orgId: string;
  currency: string;
  total: number;
  allocations: AllocationItem[];
  metadata: Record<string, unknown>;
}

export interface RptToken {
  id: string;
  version: number;
  issuedAt: string;
  payload: RptPayload;
  signature: string;
}

export class DevKms {
  constructor(private readonly secret: string) {}

  sign(message: string): string {
    return createHmac("sha256", this.secret).update(message).digest("hex");
  }

  verify(message: string, signature: string): boolean {
    return this.sign(message) === signature;
  }
}

const canonicalise = (token: Omit<RptToken, "signature">): string =>
  JSON.stringify({
    id: token.id,
    version: token.version,
    issuedAt: token.issuedAt,
    payload: token.payload,
  });

export const mintRpt = (kms: DevKms, payload: RptPayload): RptToken => {
  const enrichedPayload: RptPayload = {
    ...payload,
    metadata: payload.metadata ?? {},
  };

  const baseToken: Omit<RptToken, "signature"> = {
    id: randomUUID(),
    version: 1,
    issuedAt: new Date().toISOString(),
    payload: enrichedPayload,
  };

  const signature = kms.sign(canonicalise(baseToken));

  return {
    ...baseToken,
    signature,
  };
};

export const verifyRpt = (kms: DevKms, token: RptToken): boolean => {
  const { signature, ...withoutSignature } = token;
  return kms.verify(canonicalise(withoutSignature), signature);
};
