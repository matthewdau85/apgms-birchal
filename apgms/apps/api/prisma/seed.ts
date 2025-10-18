import {
  DesignatedAccountType,
  GateEventStatus,
  GateEventType,
  Prisma,
  PrismaClient,
  ReportType,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_ORG_ID = "org_demo_birchal";
const BAS_ANCHOR = new Date("2024-07-01T00:00:00.000Z");
const BAS_DUE_DATES = [
  new Date("2024-10-28T00:00:00.000Z"),
  new Date("2025-01-28T00:00:00.000Z"),
  new Date("2025-04-28T00:00:00.000Z"),
];

const BANK_FEED_START = new Date("2024-05-01T00:00:00.000Z");
const PAYEES = [
  "Australian Taxation Office",
  "Birchal Services",
  "Amazon Web Services",
  "Google Workspace",
  "Canva",
  "Xero",
  "HubSpot",
  "Stripe Payout",
];

const buildBankLines = (orgId: string): Prisma.BankLineCreateManyInput[] =>
  Array.from({ length: 50 }, (_, index) => {
    const day = new Date(BANK_FEED_START.getTime());
    day.setUTCDate(day.getUTCDate() + index);
    const isCredit = index % 3 === 0;
    const magnitude = 1250 + index * 37.45;
    const amount = new Prisma.Decimal((isCredit ? magnitude : -magnitude).toFixed(2));

    return {
      id: `bankline_demo_${index + 1}`,
      orgId,
      date: day,
      amount,
      payee: PAYEES[index % PAYEES.length],
      desc: `Demo transaction ${index + 1} for ${PAYEES[index % PAYEES.length]}`,
      reference: `TXN-${(index + 1).toString().padStart(4, "0")}`,
      source: index % 10 === 0 ? "manual-adjustment" : "bank-feed",
    };
  });

const designatedAccountsData = (orgId: string) => [
  {
    id: "da_demo_operating",
    orgId,
    type: DesignatedAccountType.OPERATING,
    name: "Operating Account",
    bsb: "123-456",
    accountNumber: "12345678",
    bankName: "Demo Mutual",
    lastReconciledAt: new Date("2024-08-01T00:00:00.000Z"),
  },
  {
    id: "da_demo_tax",
    orgId,
    type: DesignatedAccountType.TAX,
    name: "ATO Holding Account",
    bsb: "123-789",
    accountNumber: "87654321",
    bankName: "Demo Mutual",
    lastReconciledAt: new Date("2024-08-05T00:00:00.000Z"),
  },
  {
    id: "da_demo_payroll",
    orgId,
    type: DesignatedAccountType.PAYROLL,
    name: "Payroll Account",
    bsb: "987-654",
    accountNumber: "22223333",
    bankName: "Demo Mutual",
    lastReconciledAt: new Date("2024-07-28T00:00:00.000Z"),
  },
];

const allocationRuleSetData = (orgId: string): Prisma.AllocationRuleSetCreateManyInput[] => [
  {
    id: "ars_demo_v1",
    orgId,
    name: "Initial BAS coverage",
    version: 1,
    isDefault: false,
    designatedAccountId: "da_demo_tax",
    effectiveFrom: BAS_ANCHOR,
  },
  {
    id: "ars_demo_v2",
    orgId,
    name: "Operational and BAS buffers",
    version: 2,
    isDefault: true,
    designatedAccountId: "da_demo_operating",
    effectiveFrom: new Date("2024-09-01T00:00:00.000Z"),
  },
];

const gateEventsData = (orgId: string) => [
  {
    id: "gate_demo_registration_submitted",
    orgId,
    type: GateEventType.REGISTRATION_SUBMITTED,
    status: GateEventStatus.COMPLETED,
    occurredAt: new Date("2024-06-15T02:30:00.000Z"),
    payload: {
      actor: "alex.founder@example.com",
      note: "Demo registration submitted for review",
    },
  },
  {
    id: "gate_demo_registration_approved",
    orgId,
    type: GateEventType.REGISTRATION_APPROVED,
    status: GateEventStatus.COMPLETED,
    occurredAt: new Date("2024-06-20T04:45:00.000Z"),
    payload: {
      actor: "system",
      note: "Demo onboarding approval",
    },
  },
  {
    id: "gate_demo_bas_schedule_created",
    orgId,
    type: GateEventType.BAS_SCHEDULE_CREATED,
    status: GateEventStatus.COMPLETED,
    occurredAt: new Date("2024-06-25T01:00:00.000Z"),
    payload: {
      actor: "system",
      schedule: {
        anchor: BAS_ANCHOR.toISOString(),
        frequencyMonths: 3,
        dueDates: BAS_DUE_DATES.map((date) => date.toISOString()),
      },
    },
  },
];

const precomputedRptData = (orgId: string) => [
  {
    id: "rpt_demo_bas_q1",
    orgId,
    reportType: ReportType.BAS,
    periodStart: BAS_ANCHOR,
    periodEnd: new Date("2024-09-30T00:00:00.000Z"),
    basDueDate: BAS_DUE_DATES[0],
    generatedAt: new Date("2024-10-05T00:00:00.000Z"),
    payload: {
      summary: {
        gstCollected: 58234.12,
        gstPaid: 32941.75,
        paygWithheld: 15420.0,
      },
      lodgement: {
        statement: "Quarterly BAS",
        frequency: "QUARTERLY",
        anchor: BAS_ANCHOR.toISOString(),
        dueDate: BAS_DUE_DATES[0].toISOString(),
      },
    },
  },
  {
    id: "rpt_demo_cashflow_aug",
    orgId,
    reportType: ReportType.CASH_FLOW_SUMMARY,
    periodStart: new Date("2024-08-01T00:00:00.000Z"),
    periodEnd: new Date("2024-08-31T00:00:00.000Z"),
    basDueDate: null,
    generatedAt: new Date("2024-09-02T00:00:00.000Z"),
    payload: {
      inflows: 185000.0,
      outflows: 122500.55,
      netPosition: 62500.45,
      highlights: [
        "Equity raise received",
        "ATO payment scheduled",
        "R&D refund forecast",
      ],
    },
  },
];

async function seed() {
  const org = await prisma.org.upsert({
    where: { id: DEMO_ORG_ID },
    update: {
      name: "Birchal Demo Pty Ltd",
      timezone: "Australia/Melbourne",
      basScheduleAnchor: BAS_ANCHOR,
      basScheduleFrequencyMonths: 3,
      basSubmissionDayOfMonth: 28,
    },
    create: {
      id: DEMO_ORG_ID,
      name: "Birchal Demo Pty Ltd",
      timezone: "Australia/Melbourne",
      basScheduleAnchor: BAS_ANCHOR,
      basScheduleFrequencyMonths: 3,
      basSubmissionDayOfMonth: 28,
    },
  });

  const users = [
    {
      email: "alex.founder@example.com",
      displayName: "Alex Founder",
      password: "demo-password",
      role: UserRole.OWNER,
    },
    {
      email: "jamie.cfo@example.com",
      displayName: "Jamie CFO",
      password: "demo-password",
      role: UserRole.ADMIN,
    },
    {
      email: "casey.ops@example.com",
      displayName: "Casey Ops",
      password: "demo-password",
      role: UserRole.MEMBER,
    },
  ];

  await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany({
      where: {
        orgId: org.id,
        email: { notIn: users.map((user) => user.email) },
      },
    });

    for (const user of users) {
      await tx.user.upsert({
        where: { email: user.email },
        update: {
          displayName: user.displayName,
          role: user.role,
          password: user.password,
          orgId: org.id,
        },
        create: {
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          password: user.password,
          orgId: org.id,
        },
      });
    }

    await tx.precomputedRpt.deleteMany({ where: { orgId: org.id } });
    await tx.gateEvent.deleteMany({ where: { orgId: org.id } });
    await tx.bankLine.deleteMany({ where: { orgId: org.id } });
    await tx.allocationRuleSet.deleteMany({ where: { orgId: org.id } });
    await tx.designatedAccount.deleteMany({ where: { orgId: org.id } });

    await tx.designatedAccount.createMany({ data: designatedAccountsData(org.id), skipDuplicates: true });
    await tx.allocationRuleSet.createMany({ data: allocationRuleSetData(org.id), skipDuplicates: true });
    await tx.bankLine.createMany({ data: buildBankLines(org.id), skipDuplicates: true });

    for (const event of gateEventsData(org.id)) {
      await tx.gateEvent.create({ data: event });
    }

    for (const rpt of precomputedRptData(org.id)) {
      await tx.precomputedRpt.create({ data: rpt });
    }
  });

  console.log("Demo data seeded successfully");
}

seed()
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
