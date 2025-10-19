import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { prisma } from "@apgms/shared/db";
import { previewResponseSchema, applyResponseSchema } from "../src/schemas/allocations.js";

interface StubLedgerEntry {
  id: string;
  orgId: string;
  bankLineId: string;
  bucket: string;
  amountCents: number;
  currency: string;
  memo: string | null;
  createdAt: Date;
}

interface StubAuditBlob {
  id: string;
  orgId: string;
  kind: string;
  payloadJson: unknown;
  hash: string;
  createdAt: Date;
}

test("preview and apply routes respect schemas and persistence", async (t) => {
  const originalBankLineFindUnique = prisma.bankLine.findUnique.bind(prisma.bankLine);
  const originalRptFindFirst = prisma.rptToken.findFirst.bind(prisma.rptToken);
  const originalTransaction = prisma.$transaction.bind(prisma);

  const bankLines = [
    { id: "bank-line-1", orgId: "org-1", amount: 150.25 },
  ];
  const ledgerEntries: StubLedgerEntry[] = [];
  const auditBlobs: StubAuditBlob[] = [];
  const rptTokens: any[] = [];

  prisma.bankLine.findUnique = (async ({ where }) => {
    return bankLines.find((line) => line.id === where.id) ?? null;
  }) as any;

  prisma.rptToken.findFirst = (async () => {
    if (rptTokens.length === 0) {
      return null;
    }
    return rptTokens[rptTokens.length - 1];
  }) as any;

  prisma.$transaction = (async (callback) => {
    const tx = {
      ledgerEntry: {
        create: async ({ data }: any) => {
          const entry: StubLedgerEntry = {
            id: `le-${ledgerEntries.length + 1}`,
            orgId: data.orgId,
            bankLineId: data.bankLineId,
            bucket: data.bucket,
            amountCents: data.amountCents,
            currency: data.currency,
            memo: data.memo ?? null,
            createdAt: new Date("2024-01-01T00:00:00Z"),
          };
          ledgerEntries.push(entry);
          return entry;
        },
      },
      rptToken: {
        create: async ({ data }: any) => {
          const record = { ...data };
          rptTokens.push(record);
          return record;
        },
      },
      auditBlob: {
        create: async ({ data }: any) => {
          const blob: StubAuditBlob = {
            id: `audit-${auditBlobs.length + 1}`,
            orgId: data.orgId,
            kind: data.kind,
            payloadJson: data.payloadJson,
            hash: data.hash,
            createdAt: new Date("2024-01-01T00:00:10Z"),
          };
          auditBlobs.push(blob);
          return blob;
        },
      },
    };
    return callback(tx);
  }) as any;

  const app = await buildApp();
  t.after(async () => {
    await app.close();
    prisma.bankLine.findUnique = originalBankLineFindUnique as any;
    prisma.rptToken.findFirst = originalRptFindFirst as any;
    prisma.$transaction = originalTransaction as any;
  });

  const previewResponse = await app.inject({
    method: "POST",
    url: "/allocations/preview",
    payload: {
      bankLineId: "bank-line-1",
      ruleset: {
        strategy: "proportional",
        allocations: [
          { bucket: "ops", weight: 1 },
          { bucket: "savings", weight: 1 },
        ],
        gates: ["gate-open"],
        noRemittanceBucket: "hold",
      },
      accountStates: {
        gates: [{ id: "gate-open", state: "OPEN" }],
      },
    },
  });

  assert.equal(previewResponse.statusCode, 200);
  const previewBody = previewResponse.json();
  const parsedPreview = previewResponseSchema.parse(previewBody);
  assert.equal(
    parsedPreview.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0),
    Math.round(bankLines[0].amount * 100)
  );

  const applyResponse = await app.inject({
    method: "POST",
    url: "/allocations/apply",
    payload: {
      bankLineId: "bank-line-1",
      ruleset: {
        strategy: "proportional",
        allocations: [
          { bucket: "ops", weight: 2 },
          { bucket: "savings", weight: 1 },
          { bucket: "tax", weight: 1 },
        ],
        gates: [],
        noRemittanceBucket: "hold",
      },
      accountStates: {
        gates: [],
      },
      memo: "Seed memo",
    },
  });

  assert.equal(applyResponse.statusCode, 201);
  const applyBody = applyResponse.json();
  const parsedApply = applyResponseSchema.parse(applyBody);
  assert.equal(parsedApply.ledgerEntries.length, parsedApply.allocations.length);
  assert.equal(ledgerEntries.length, parsedApply.allocations.length);
  assert.equal(auditBlobs.length, 1);
  assert.ok(parsedApply.rpt.id.length > 0);
  assert.equal(parsedApply.rpt.prevHash, "GENESIS");
  assert.equal(parsedApply.policyHash.length > 0, true);
});
