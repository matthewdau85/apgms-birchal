import { createHash, createHmac, randomUUID } from "node:crypto";
import type { AllocationPreview } from "./allocations";

export interface MintRptInput extends AllocationPreview {
  prevHash: string;
}

export interface RptToken extends MintRptInput {
  id: string;
  mintedAt: string;
  signature: string;
  hash: string;
}

const secret = process.env.DEV_KMS_SECRET ?? "dev-kms-secret";

type RptPayload = Pick<
  RptToken,
  "orgId" | "bankLineId" | "policyHash" | "allocations" | "totalAllocated" | "prevHash" | "mintedAt"
>;

const buildPayload = (input: RptPayload) =>
  JSON.stringify({
    orgId: input.orgId,
    bankLineId: input.bankLineId,
    policyHash: input.policyHash,
    allocations: input.allocations,
    totalAllocated: input.totalAllocated,
    prevHash: input.prevHash,
    mintedAt: input.mintedAt,
  });

const computeSignature = (payload: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");

const computeHash = (payload: string) => createHash("sha256").update(payload).digest("hex");

export class DevKms {
  async mintRpt(input: MintRptInput): Promise<RptToken> {
    const mintedAt = new Date().toISOString();
    const payload = buildPayload({
      orgId: input.orgId,
      bankLineId: input.bankLineId,
      policyHash: input.policyHash,
      allocations: input.allocations,
      totalAllocated: input.totalAllocated,
      prevHash: input.prevHash,
      mintedAt,
    });

    const signature = computeSignature(payload);
    const hash = computeHash(payload);

    return {
      id: randomUUID(),
      ...input,
      mintedAt,
      signature,
      hash,
    };
  }

  verifyRpt(token: RptToken): boolean {
    const payload = buildPayload({
      orgId: token.orgId,
      bankLineId: token.bankLineId,
      policyHash: token.policyHash,
      allocations: token.allocations,
      totalAllocated: token.totalAllocated,
      prevHash: token.prevHash,
      mintedAt: token.mintedAt,
    });
    const expectedSignature = computeSignature(payload);
    const expectedHash = computeHash(payload);

    return token.signature === expectedSignature && token.hash === expectedHash;
  }
}

export const devKms = new DevKms();

export const verifyRpt = (token: RptToken): boolean => devKms.verifyRpt(token);
