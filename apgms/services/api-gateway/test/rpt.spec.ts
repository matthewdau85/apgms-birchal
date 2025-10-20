import { describe, expect, it } from "vitest";

const rptModule: any = (() => {
  try {
    return require("../src/rpt");
  } catch (error) {
    throw new Error("Expected ../src/rpt to be resolvable for integrity tests");
  }
})();

const mintReceipt: any =
  rptModule?.mintReceipt ??
  rptModule?.mint ??
  rptModule?.default?.mintReceipt ??
  rptModule?.default?.mint;

const verifyReceipt: any =
  rptModule?.verifyReceipt ??
  rptModule?.verify ??
  rptModule?.default?.verifyReceipt ??
  rptModule?.default?.verify;

const verifyChain: any =
  rptModule?.verifyChain ??
  rptModule?.verifyReceipts ??
  rptModule?.default?.verifyChain ??
  rptModule?.default?.verifyReceipts;

if (typeof mintReceipt !== "function") {
  throw new Error("mintReceipt export not found on RPT module");
}
if (typeof verifyReceipt !== "function") {
  throw new Error("verifyReceipt export not found on RPT module");
}
if (typeof verifyChain !== "function") {
  throw new Error("verifyChain export not found on RPT module");
}

function mint(payload: Record<string, any>, prevHash: string) {
  const basePayload = { ...payload };
  const attempts = [
    () => mintReceipt({ ...basePayload, prevHash }),
    () => mintReceipt(basePayload, { prevHash }),
    () => mintReceipt(basePayload, prevHash),
    () => mintReceipt({ payload: basePayload, prevHash }),
    () => mintReceipt({ payload: basePayload, meta: { prevHash } }),
    () => mintReceipt({ ...basePayload, meta: { prevHash } }),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to mint receipt with provided payload");
}

function readHash(receipt: any): string {
  const candidates = [
    receipt?.hash,
    receipt?.receiptHash,
    receipt?.digest,
    receipt?.metadata?.hash,
    receipt?.meta?.hash,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  throw new Error("Receipt does not expose a hash field");
}

function readPrevHash(receipt: any): string {
  const candidates = [
    receipt?.prevHash,
    receipt?.previousHash,
    receipt?.meta?.prevHash,
    receipt?.headers?.prevHash,
    receipt?.metadata?.prevHash,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  throw new Error("Receipt does not expose a prevHash field");
}

function setPrevHash(receipt: any, value: string) {
  if ("prevHash" in receipt) {
    receipt.prevHash = value;
  }
  if (receipt.meta) {
    receipt.meta.prevHash = value;
  }
  if (receipt.metadata) {
    receipt.metadata.prevHash = value;
  }
  if (receipt.headers) {
    receipt.headers.prevHash = value;
  }
}

function tamperPayload(receipt: any) {
  if (receipt.payload && typeof receipt.payload === "object") {
    receipt.payload = { ...receipt.payload, __tampered: true };
    return;
  }
  if (receipt.data && typeof receipt.data === "object") {
    receipt.data = { ...receipt.data, __tampered: true };
    return;
  }
  receipt.extra = { tampered: true };
}

describe("RPT integrity", () => {
  it("mints a receipt that verifies", () => {
    const receipt = mint({ id: "rpt-1", amountCents: 1234 }, "");
    expect(verifyReceipt(receipt)).toBe(true);
  });

  it("fails verification when tampered", () => {
    const receipt = mint({ id: "rpt-2", amountCents: 4321 }, "");
    expect(verifyReceipt(receipt)).toBe(true);

    const tampered = { ...receipt };
    tamperPayload(tampered);

    expect(verifyReceipt(tampered)).toBe(false);
  });

  it("validates and rejects RPT chains appropriately", () => {
    const genesis = mint({ id: "rpt-1", amountCents: 111 }, "");
    const rpt2 = mint({ id: "rpt-2", amountCents: 222 }, readHash(genesis));
    const rpt3 = mint({ id: "rpt-3", amountCents: 333 }, readHash(rpt2));

    expect(verifyChain([genesis, rpt2, rpt3])).toBe(true);

    const broken = { ...rpt2 };
    setPrevHash(broken, "not-the-right-prev-hash");
    expect(verifyChain([genesis, broken, rpt3])).toBe(false);
  });
});
