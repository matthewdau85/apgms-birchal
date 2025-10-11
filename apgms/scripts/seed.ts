import {
  AccountingMethod,
  BasCycle,
  EvidenceScope,
  FinanceAccountType,
  GstTaxCode,
  MandateStatus,
  MembershipRole,
  PaymentEventType,
  PaymentStatus,
  PrismaClient,
  TaxPeriodStatus,
  TaxRegistrationType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function reset() {
  await prisma.auditRpt.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.reconException.deleteMany();
  await prisma.reconMatch.deleteMany();
  await prisma.bankLine.deleteMany();
  await prisma.bankImport.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.financeMandate.deleteMany();
  await prisma.financeAccount.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.paygwWithholdingCalc.deleteMany();
  await prisma.paygwPayEvent.deleteMany();
  await prisma.paygwEmployee.deleteMany();
  await prisma.gstBasCalc.deleteMany();
  await prisma.gstAdjustment.deleteMany();
  await prisma.gstPurchase.deleteMany();
  await prisma.gstSupply.deleteMany();
  await prisma.taxScheduleMeta.deleteMany();
  await prisma.adminIngestionJob.deleteMany();
  await prisma.adminDocument.deleteMany();
  await prisma.taxPeriod.deleteMany();
  await prisma.taxRegistration.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();
}

function cents(value: number) {
  return Math.round(value * 100);
}

async function seedOrg(index: number) {
  const baseDate = new Date();
  const startMonth = Math.floor(baseDate.getMonth() / 3) * 3;
  const currentQuarterStart = new Date(baseDate.getFullYear(), startMonth, 1);
  const currentQuarterEnd = new Date(currentQuarterStart);
  currentQuarterEnd.setMonth(currentQuarterEnd.getMonth() + 3);
  currentQuarterEnd.setDate(currentQuarterEnd.getDate() - 1);

  const org = await prisma.org.create({
    data: {
      name: index === 1 ? "Birchal Demo Pty Ltd" : "Acme Services Co",
      abn: index === 1 ? "12345678901" : "98765432109",
      accountingMethod: index === 1 ? AccountingMethod.ACCRUAL : AccountingMethod.CASH,
      basCycle: index === 1 ? BasCycle.QUARTERLY : BasCycle.MONTHLY,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: index === 1 ? "founder@birchal.demo" : "ceo@acme.demo",
      password: "argon2$demo", // placeholder for hashed password
      name: index === 1 ? "Ava Founder" : "Ben Manager",
      memberships: {
        create: {
          orgId: org.id,
          role: MembershipRole.OWNER,
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: index === 1 ? "accountant@birchal.demo" : "bookkeeper@acme.demo",
      password: "argon2$demo",
      name: index === 1 ? "Charlotte Ledger" : "Dylan Numbers",
      memberships: {
        create: {
          orgId: org.id,
          role: MembershipRole.ACCOUNTANT,
          invitedBy: owner.id,
        },
      },
    },
  });

  const revenueAccount = await prisma.financeAccount.create({
    data: {
      orgId: org.id,
      type: FinanceAccountType.OPERATING,
      displayName: "Operating Account",
      institution: "Sample Bank",
      bsb: "123-456",
      accountNumber: index === 1 ? "12345678" : "98765432",
      balanceCents: cents(82500.5),
    },
  });

  const gstWallet = await prisma.financeAccount.create({
    data: {
      orgId: org.id,
      type: FinanceAccountType.GST_WALLET,
      displayName: "GST One-Way Wallet",
      institution: "Sample Bank",
      bsb: "123-456",
      accountNumber: index === 1 ? "44556677" : "55667788",
      oneWay: true,
      balanceCents: cents(10250.75),
    },
  });

  const paygwWallet = await prisma.financeAccount.create({
    data: {
      orgId: org.id,
      type: FinanceAccountType.PAYGW_WALLET,
      displayName: "PAYGW One-Way Wallet",
      institution: "Sample Bank",
      bsb: "123-456",
      accountNumber: index === 1 ? "88990011" : "11009988",
      oneWay: true,
      balanceCents: cents(6400.25),
    },
  });

  const mandate = await prisma.financeMandate.create({
    data: {
      orgId: org.id,
      accountId: revenueAccount.id,
      reference: index === 1 ? "BIRCHAL-PAYTO" : "ACME-PAYTO",
      status: MandateStatus.ACTIVE,
      activatedAt: new Date(),
    },
  });

  await prisma.taxRegistration.createMany({
    data: [
      {
        orgId: org.id,
        type: TaxRegistrationType.GST,
        effectiveFrom: new Date(baseDate.getFullYear() - 1, 6, 1),
        accountBsb: gstWallet.bsb,
        accountNumber: gstWallet.accountNumber,
      },
      {
        orgId: org.id,
        type: TaxRegistrationType.PAYGW,
        effectiveFrom: new Date(baseDate.getFullYear() - 1, 6, 1),
        accountBsb: paygwWallet.bsb,
        accountNumber: paygwWallet.accountNumber,
      },
    ],
  });

  const previousPeriod = await prisma.taxPeriod.create({
    data: {
      orgId: org.id,
      abn: org.abn ?? "00000000000",
      label: index === 1 ? "2023Q4" : "2024M05",
      status: TaxPeriodStatus.LODGED,
      dueDate: new Date(baseDate.getFullYear(), baseDate.getMonth() - 2, 21),
      lockDate: new Date(baseDate.getFullYear(), baseDate.getMonth() - 3, 30),
      lodgedAt: new Date(baseDate.getFullYear(), baseDate.getMonth() - 2, 20),
    },
  });

  const currentPeriod = await prisma.taxPeriod.create({
    data: {
      orgId: org.id,
      abn: org.abn ?? "00000000000",
      label: index === 1 ? "2024Q1" : "2024M06",
      status: TaxPeriodStatus.OPEN,
      dueDate: new Date(currentQuarterEnd.getFullYear(), currentQuarterEnd.getMonth() + 1, 21),
    },
  });

  const supplyData = [
    {
      orgId: org.id,
      periodId: currentPeriod.id,
      description: "Consulting services",
      supplyDate: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth(), 12),
      amountCents: cents(27500),
      gstCents: cents(27500 * 0.1),
      taxCode: GstTaxCode.TX,
    },
    {
      orgId: org.id,
      periodId: currentPeriod.id,
      description: "Export goods",
      supplyDate: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth() + 1, 5),
      amountCents: cents(8200),
      gstCents: 0,
      taxCode: GstTaxCode.FRE,
    },
  ];
  await prisma.gstSupply.createMany({ data: supplyData });

  const purchaseData = [
    {
      orgId: org.id,
      periodId: currentPeriod.id,
      description: "Software subscription",
      purchaseDate: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth(), 18),
      amountCents: cents(1200),
      gstCents: cents(120),
      taxCode: GstTaxCode.TX,
    },
    {
      orgId: org.id,
      periodId: currentPeriod.id,
      description: "Entertainment (non-claimable)",
      purchaseDate: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth(), 27),
      amountCents: cents(450),
      gstCents: 0,
      taxCode: GstTaxCode.NT,
    },
  ];
  await prisma.gstPurchase.createMany({ data: purchaseData });

  await prisma.gstAdjustment.create({
    data: {
      orgId: org.id,
      periodId: currentPeriod.id,
      description: "Prior period adjustment",
      amountCents: cents(320),
      gstCents: cents(32),
      taxCode: GstTaxCode.ADJ,
    },
  });

  const employee = await prisma.paygwEmployee.create({
    data: {
      orgId: org.id,
      firstName: "Jordan",
      lastName: index === 1 ? "Taylor" : "Nguyen",
      tfn: "123456789",
      stsl: index === 1,
      taxFreeThreshold: true,
    },
  });

  await prisma.paygwPayEvent.createMany({
    data: [
      {
        orgId: org.id,
        employeeId: employee.id,
        periodId: currentPeriod.id,
        payDate: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth(), 15),
        grossCents: cents(3200),
        withheldCents: cents(620),
        stslCents: cents(index === 1 ? 45 : 0),
      },
      {
        orgId: org.id,
        employeeId: employee.id,
        periodId: currentPeriod.id,
        payDate: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth() + 1, 15),
        grossCents: cents(3300),
        withheldCents: cents(640),
        stslCents: cents(index === 1 ? 45 : 0),
      },
    ],
  });

  const bankImport = await prisma.bankImport.create({
    data: {
      orgId: org.id,
      filename: index === 1 ? "birchal-demo.ofx" : "acme-demo.csv",
      format: index === 1 ? "OFX" : "CSV",
      fileHash: "demo-hash",
    },
  });

  const bankLineOne = await prisma.bankLine.create({
    data: {
      orgId: org.id,
      importId: bankImport.id,
      date: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth(), 16),
      amount: 3200.0,
      payee: "Payroll",
      desc: "Payroll debit",
      reference: "PAYGW-DEBIT",
      status: "matched",
    },
  });

  const bankLineTwo = await prisma.bankLine.create({
    data: {
      orgId: org.id,
      importId: bankImport.id,
      date: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth() + 1, 2),
      amount: 8250.0,
      payee: "ATO",
      desc: "GST remittance",
      reference: "GST-WALLET",
      status: "needs_review",
    },
  });

  const paymentSettled = await prisma.payment.create({
    data: {
      orgId: org.id,
      accountId: paygwWallet.id,
      mandateId: mandate.id,
      periodId: currentPeriod.id,
      amountCents: cents(1260),
      status: PaymentStatus.SETTLED,
      reference: index === 1 ? "PAYGW-MAR" : "PAYGW-JUN",
      description: "PAYGW withholding",
      settledAt: new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth(), 16),
      events: {
        create: {
          type: PaymentEventType.CAPTURED,
          detail: {
            message: "Payment settled via mock PayTo",
          },
        },
      },
    },
  });

  const paymentPending = await prisma.payment.create({
    data: {
      orgId: org.id,
      accountId: gstWallet.id,
      mandateId: mandate.id,
      periodId: currentPeriod.id,
      amountCents: cents(2750),
      status: PaymentStatus.PENDING_CAPTURE,
      reference: index === 1 ? "GST-Q1" : "GST-MAY",
      description: "GST transfer to wallet",
    },
  });

  await prisma.reconMatch.create({
    data: {
      orgId: org.id,
      bankLineId: bankLineOne.id,
      paymentId: paymentSettled.id,
      confidence: 0.98,
      status: "reconciled",
      note: "Auto matched based on reference",
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        orgId: org.id,
        actorId: owner.id,
        entityType: "mandate",
        entityId: mandate.id,
        action: "activated",
        afterHash: "hash-mandate",
      },
      {
        orgId: org.id,
        actorId: owner.id,
        entityType: "anomaly",
        entityId: `${org.id}-${currentPeriod.id}`,
        action: "anomaly_flag",
        afterHash: "gst-swing",
      },
    ],
  });

  await prisma.auditRpt.create({
    data: {
      orgId: org.id,
      periodId: currentPeriod.id,
      scope: EvidenceScope.BAS,
      tokenId: `rpt-${org.id}-${currentPeriod.id}`,
      evidenceDigest: "sha256-demo",
      createdBy: owner.id,
      expiresAt: new Date(currentQuarterEnd.getFullYear(), currentQuarterEnd.getMonth() + 2, 1),
    },
  });

  const document = await prisma.adminDocument.create({
    data: {
      storagePath: index === 1 ? "docs/ato_gst_2024.pdf" : "docs/ato_paygw_2024.pdf",
      type: "ATO_RULE",
      source: "ATO",
      version: "2024.1",
      metadata: {
        description: "Imported reference schedule",
      },
    },
  });

  await prisma.taxScheduleMeta.create({
    data: {
      registration: TaxRegistrationType.GST,
      source: "ATO",
      version: "2024.1",
      effectiveFrom: new Date(baseDate.getFullYear(), 0, 1),
      documentId: document.id,
      metadata: {
        note: "Standard GST rates",
      },
    },
  });

  await prisma.adminIngestionJob.create({
    data: {
      documentId: document.id,
      status: "complete",
      completedAt: new Date(),
    },
  });

  return { org, currentPeriod };
}

async function main() {
  await reset();
  const results = [];
  for (const index of [1, 2]) {
    results.push(await seedOrg(index));
  }
  console.log(
    `Seeded ${results.length} orgs with demo data: ${results
      .map((r) => `${r.org.name} (${r.currentPeriod.label})`)
      .join(", ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
