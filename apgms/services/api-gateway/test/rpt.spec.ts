import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { utils, getPublicKey, sign } from "@noble/ed25519";
import auditRoutes from "../src/routes/audit.js";
import {
  mintRpt,
  verifyRpt,
  verifyChain,
  type SignedRpt,
  type MintRptParams,
} from "../src/lib/rpt.js";

const createKms = (secretKey: Uint8Array) => ({
  sign: async (data: Uint8Array) => sign(data, secretKey),
});

const baseAllocations = [
  { accountId: "acct:1", amount: "100.00" },
  { accountId: "acct:2", amount: "50.00" },
];

const baseParams = (overrides: Partial<MintRptParams> = {}): MintRptParams => ({
  rptId: overrides.rptId ?? "rpt-1",
  orgId: overrides.orgId ?? "org-1",
  bankLineId: overrides.bankLineId ?? "bank-1",
  policyHash: overrides.policyHash ?? "policy-1",
  allocations: overrides.allocations ?? baseAllocations,
  prevHash: overrides.prevHash ?? null,
  now: overrides.now ?? new Date("2024-01-01T00:00:00.000Z"),
});

const setupKeys = async () => {
  const secretKey = utils.randomPrivateKey();
  const publicKey = await getPublicKey(secretKey);
  return { secretKey, publicKey, kms: createKms(secretKey) };
};

const register = (store: Map<string, SignedRpt>) =>
  async (idOrHash: string): Promise<SignedRpt | null> => store.get(idOrHash) ?? null;

test("minted RPT verifies", async () => {
  const { publicKey, kms } = await setupKeys();
  const rpt = await mintRpt(baseParams(), kms);
  assert.equal(await verifyRpt(rpt, Buffer.from(publicKey).toString("base64")), true);
});

test("tampered RPT fails verification", async () => {
  const { publicKey, kms } = await setupKeys();
  const rpt = await mintRpt(baseParams(), kms);
  const tampered = {
    ...rpt,
    allocations: [{ accountId: "acct:1", amount: "999.00" }],
  };
  assert.equal(await verifyRpt(tampered, publicKey), false);
});

test("chain integrity succeeds and fails when broken", async () => {
  const { kms } = await setupKeys();
  const first = await mintRpt(baseParams({ rptId: "rpt-1" }), kms);
  const second = await mintRpt(baseParams({ rptId: "rpt-2", prevHash: first.hash }), kms);
  const third = await mintRpt(baseParams({ rptId: "rpt-3", prevHash: second.hash }), kms);

  const store = new Map<string, SignedRpt>([
    [first.hash, first],
    [second.hash, second],
    [third.hash, third],
    [third.rptId, third],
    [second.rptId, second],
    [first.rptId, first],
  ]);

  assert.equal(await verifyChain(third.rptId, register(store)), true);

  const broken = await mintRpt(baseParams({ rptId: "rpt-4", prevHash: "deadbeef" }), kms);
  store.set(broken.hash, broken);
  store.set(broken.rptId, broken);
  assert.equal(await verifyChain(broken.rptId, register(store)), false);
});

test("audit endpoint returns verification result", async () => {
  const { publicKey, kms } = await setupKeys();
  const first = await mintRpt(baseParams({ rptId: "rpt-1" }), kms);
  const second = await mintRpt(baseParams({ rptId: "rpt-2", prevHash: first.hash }), kms);

  const store = new Map<string, SignedRpt>([
    [first.hash, first],
    [second.hash, second],
    [first.rptId, first],
    [second.rptId, second],
  ]);

  const app = Fastify();
  await auditRoutes(app, {
    loadRpt: register(store),
    loadPrev: register(store),
    pubkey: Buffer.from(publicKey).toString("base64"),
  });

  const okResponse = await app.inject({ method: "GET", url: `/audit/rpt/${second.rptId}` });
  assert.equal(okResponse.statusCode, 200);
  const parsedOk = okResponse.json() as { ok: boolean };
  assert.equal(parsedOk.ok, true);

  const broken = await mintRpt(baseParams({ rptId: "rpt-3", prevHash: "ffff" }), kms);
  store.set(broken.hash, broken);
  store.set(broken.rptId, broken);
  const failResponse = await app.inject({ method: "GET", url: `/audit/rpt/${broken.rptId}` });
  assert.equal(failResponse.statusCode, 400);
  const parsedFail = failResponse.json() as { ok: boolean; reason: string };
  assert.equal(parsedFail.ok, false);
  assert.equal(parsedFail.reason, "invalid_chain");
});
