import { createHash } from "crypto";
import { LedgerEntryType, PrismaClient, RptTokenStatus } from "@prisma/client";

const prisma = new PrismaClient();

function computeHash(kind: string, data: unknown, prevHash: string | null) {
  return createHash("sha256")
    .update(JSON.stringify({ kind, prevHash, data }))
    .digest("hex");
}

async function seedBankLines(orgId: string) {
  const payees = [
    "Acme Office",
    "Birchal",
    "CloudCo",
    "Dynamics Legal",
    "Everyday Utilities",
    "Founders Retreat",
    "Growth Labs",
    "Heritage Accounting",
    "Inspire Media",
    "Journey Travel"
  ];
  const descriptions = [
    "Subscription renewal",
    "Supplier payment",
    "Professional services",
    "Campaign spend",
    "Investor funds received"
  ];
  const start = new Date();
  start.setDate(start.getDate() - 60);

  const bankLines = Array.from({ length: 50 }).map((_, index) => {
    const entryDate = new Date(start.getTime());
    entryDate.setDate(start.getDate() + index);
    const payee = payees[index % payees.length];
    const description = descriptions[index % descriptions.length];
    const amount = (index % 5 === 0 ? 15000 : (index % 2 === 0 ? -499.95 : 1200.5)) + index * 3;

    return {
      id: `demo-bank-line-${index + 1}`,
      orgId,
      date: entryDate,
      amount: amount.toFixed(2),
      payee,
      desc: description,
      createdAt: entryDate,
    };
  });

  await prisma.bankLine.createMany({ data: bankLines, skipDuplicates: true });
}

async function seedPolicies(orgId: string) {
  const policy = await prisma.policy.upsert({
    where: { id: "policy-demo-equity" },
    update: {},
    create: {
      id: "policy-demo-equity",
      orgId,
      name: "Equity Crowdfunding Policy",
      version: 1,
      summary: "Baseline gating and allocation policy for demo investments",
      config: {
        jurisdiction: "AU",
        thresholds: {
          maxRaise: 5000000,
          retailCap: 10000,
        },
        approvalsRequired: ["compliance", "finance"],
      },
    },
  });

  const ruleSets = [] as Awaited<ReturnType<typeof prisma.allocationRuleSet.upsert>>[];
  const ruleDefinitions = [
    {
      id: "ars-standard",
      name: "Standard Retail Allocation",
      definition: {
        rules: [
          { tier: "retail", maxAllocation: 10000 },
          { tier: "wholesale", maxAllocation: 250000 },
        ],
      },
    },
    {
      id: "ars-priority",
      name: "Priority Birchal Members",
      definition: {
        rules: [
          { tier: "priority", multiplier: 1.5 },
          { tier: "retail", multiplier: 1 },
        ],
        windowMinutes: 60,
      },
    },
  ];

  for (const definition of ruleDefinitions) {
    const ruleSet = await prisma.allocationRuleSet.upsert({
      where: { id: definition.id },
      update: {},
      create: {
        id: definition.id,
        policyId: policy.id,
        name: definition.name,
        definition: definition.definition,
      },
    });
    ruleSets.push(ruleSet);
  }

  return { policy, ruleSets };
}

async function seedGateEventsAndLedgers(orgId: string, policyId: string, ruleSets: { id: string }[]) {
  const gateEventsInput = [
    {
      id: "gate-event-001",
      requestId: "REQ-GATE-001",
      eventType: "POLICY_PUBLISHED",
      payload: {
        actor: "compliance@demo.org",
        status: "draft",
      },
      allocationRuleSetId: null,
    },
    {
      id: "gate-event-002",
      requestId: "REQ-GATE-002",
      eventType: "POLICY_APPROVED",
      payload: {
        actor: "finance@demo.org",
        approvals: ["compliance", "finance"],
      },
      allocationRuleSetId: ruleSets[0]?.id ?? null,
    },
    {
      id: "gate-event-003",
      requestId: "REQ-GATE-003",
      eventType: "RPT_ISSUED",
      payload: {
        tranche: "founders",
        allocationRule: ruleSets[1]?.id ?? null,
      },
      allocationRuleSetId: ruleSets[1]?.id ?? null,
    },
  ];

  const gateEvents = [] as Awaited<ReturnType<typeof prisma.gateEvent.upsert>>[];
  let previousGate: { id: string; hash: string } | null = null;

  for (const input of gateEventsInput) {
    const hash = computeHash(
      "GateEvent",
      {
        requestId: input.requestId,
        eventType: input.eventType,
        payload: input.payload,
      },
      previousGate?.hash ?? null,
    );

    const gateEvent = await prisma.gateEvent.upsert({
      where: { id: input.id },
      update: {},
      create: {
        id: input.id,
        orgId,
        policyId,
        allocationRuleSetId: input.allocationRuleSetId,
        requestId: input.requestId,
        eventType: input.eventType,
        payload: input.payload,
        prevEventId: previousGate?.id ?? null,
        prevHash: previousGate?.hash ?? null,
        hash,
      },
    });

    gateEvents.push(gateEvent);
    previousGate = { id: gateEvent.id, hash: gateEvent.hash };
  }

  const ledgerInput = [
    {
      id: "ledger-entry-001",
      requestId: "REQ-LEDGER-001",
      entryType: LedgerEntryType.CREDIT,
      amount: "50000.00",
      memo: "Capital committed for Q4 round",
      gateEventIndex: 1,
    },
    {
      id: "ledger-entry-002",
      requestId: "REQ-LEDGER-002",
      entryType: LedgerEntryType.DEBIT,
      amount: "1250.75",
      memo: "Due diligence and legal fees",
      gateEventIndex: 2,
    },
  ];

  const ledgerEntries = [] as Awaited<ReturnType<typeof prisma.ledgerEntry.upsert>>[];
  let previousLedger: { id: string; hash: string } | null = null;

  for (const entry of ledgerInput) {
    const hash = computeHash(
      "LedgerEntry",
      {
        requestId: entry.requestId,
        entryType: entry.entryType,
        amount: entry.amount,
        memo: entry.memo,
      },
      previousLedger?.hash ?? null,
    );

    const ledgerEntry = await prisma.ledgerEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: {
        id: entry.id,
        orgId,
        gateEventId: typeof entry.gateEventIndex === "number" ? gateEvents[entry.gateEventIndex]?.id ?? null : null,
        requestId: entry.requestId,
        entryType: entry.entryType,
        amount: entry.amount,
        currency: "AUD",
        memo: entry.memo,
        prevEntryId: previousLedger?.id ?? null,
        prevHash: previousLedger?.hash ?? null,
        hash,
      },
    });

    ledgerEntries.push(ledgerEntry);
    previousLedger = { id: ledgerEntry.id, hash: ledgerEntry.hash };
  }

  const rptTokens = [] as Awaited<ReturnType<typeof prisma.rptToken.upsert>>[];
  const rptInput = [
    {
      id: "rpt-token-001",
      requestId: "REQ-RPT-001",
      token: "RPT-DEMO-0001",
      status: RptTokenStatus.ISSUED,
      allocationRuleSetId: ruleSets[0]?.id ?? null,
      gateEventIndex: 2,
      metadata: {
        tranche: "founders",
        units: 1000,
      },
    },
    {
      id: "rpt-token-002",
      requestId: "REQ-RPT-002",
      token: "RPT-DEMO-0002",
      status: RptTokenStatus.REVOKED,
      allocationRuleSetId: ruleSets[1]?.id ?? null,
      gateEventIndex: 2,
      metadata: {
        tranche: "priority",
        units: 250,
        revokedByRequest: "REQ-GATE-003",
      },
    },
  ];

  for (const token of rptInput) {
    const record = await prisma.rptToken.upsert({
      where: { id: token.id },
      update: {},
      create: {
        id: token.id,
        orgId,
        policyId,
        allocationRuleSetId: token.allocationRuleSetId,
        gateEventId: typeof token.gateEventIndex === "number" ? gateEvents[token.gateEventIndex]?.id ?? null : null,
        requestId: token.requestId,
        token: token.token,
        status: token.status,
        metadata: token.metadata,
      },
    });

    rptTokens.push(record);
  }

  const auditInput = [
    {
      id: "audit-blob-001",
      requestId: "REQ-AUDIT-001",
      gateEventIndex: 0,
      ledgerEntryIndex: null,
      content: "Initial policy draft snapshot",
      contentType: "text/plain",
    },
    {
      id: "audit-blob-002",
      requestId: "REQ-AUDIT-002",
      gateEventIndex: 1,
      ledgerEntryIndex: 0,
      content: "Finance approval certificate",
      contentType: "text/plain",
    },
    {
      id: "audit-blob-003",
      requestId: "REQ-AUDIT-003",
      gateEventIndex: 2,
      ledgerEntryIndex: 1,
      content: "RPT issuance confirmation",
      contentType: "text/plain",
    },
  ];

  const auditBlobs = [] as Awaited<ReturnType<typeof prisma.auditBlob.upsert>>[];
  let previousBlob: { id: string; hash: string } | null = null;

  for (const blob of auditInput) {
    const hash = computeHash(
      "AuditBlob",
      {
        requestId: blob.requestId,
        content: blob.content,
      },
      previousBlob?.hash ?? null,
    );

    const record = await prisma.auditBlob.upsert({
      where: { id: blob.id },
      update: {},
      create: {
        id: blob.id,
        orgId,
        gateEventId: typeof blob.gateEventIndex === "number" ? gateEvents[blob.gateEventIndex]?.id ?? null : null,
        ledgerEntryId: typeof blob.ledgerEntryIndex === "number" ? ledgerEntries[blob.ledgerEntryIndex]?.id ?? null : null,
        requestId: blob.requestId,
        content: Buffer.from(blob.content, "utf-8"),
        contentType: blob.contentType,
        prevBlobId: previousBlob?.id ?? null,
        prevHash: previousBlob?.hash ?? null,
        hash,
      },
    });

    auditBlobs.push(record);
    previousBlob = { id: record.id, hash: record.hash };
  }

  return { gateEvents, ledgerEntries, rptTokens, auditBlobs };
}

async function main() {
  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Demo Org" },
  });

  await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: {},
    create: { email: "founder@example.com", password: "password123", orgId: org.id },
  });

  await seedBankLines(org.id);

  const { policy, ruleSets } = await seedPolicies(org.id);
  await seedGateEventsAndLedgers(org.id, policy.id, ruleSets.map((rule) => ({ id: rule.id })));

  const [orgCount, userCount, bankLineCount, policyCount, ruleSetCount, gateEventCount, ledgerEntryCount, rptTokenCount, auditBlobCount] =
    await Promise.all([
      prisma.org.count(),
      prisma.user.count(),
      prisma.bankLine.count(),
      prisma.policy.count(),
      prisma.allocationRuleSet.count(),
      prisma.gateEvent.count(),
      prisma.ledgerEntry.count(),
      prisma.rptToken.count(),
      prisma.auditBlob.count(),
    ]);

  console.log("Seed counts", {
    orgs: orgCount,
    users: userCount,
    bankLines: bankLineCount,
    policies: policyCount,
    allocationRuleSets: ruleSetCount,
    gateEvents: gateEventCount,
    ledgerEntries: ledgerEntryCount,
    rptTokens: rptTokenCount,
    auditBlobs: auditBlobCount,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
