import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const SCRYPT_N = Number(process.env.PASSWORD_SCRYPT_N ?? 16384);
const SCRYPT_r = Number(process.env.PASSWORD_SCRYPT_R ?? 8);
const SCRYPT_p = Number(process.env.PASSWORD_SCRYPT_P ?? 1);
const KEY_LEN = Number(process.env.PASSWORD_KEYLEN ?? 64);

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 128 * SCRYPT_N * SCRYPT_r,
  });
  return [
    "scrypt",
    `n=${SCRYPT_N}`,
    `r=${SCRYPT_r}`,
    `p=${SCRYPT_p}`,
    `len=${KEY_LEN}`,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

async function seedOrg(slug: string, name: string) {
  const existing = await prisma.org.upsert({
    where: { slug },
    update: { name },
    create: { id: randomUUID(), slug, name },
  });

  const baseUsers = [
    { email: `founder@${slug}.example`, role: UserRole.OWNER },
    { email: `ops@${slug}.example`, role: UserRole.ADMIN },
    { email: `analyst@${slug}.example`, role: UserRole.ACCOUNTANT },
  ];

  const seededUsers = [] as {
    id: string;
    email: string;
    role: UserRole;
  }[];

  for (const [index, user] of baseUsers.entries()) {
    const created = await prisma.user.upsert({
      where: { orgId_email: { orgId: existing.id, email: user.email } },
      update: { role: user.role },
      create: {
        id: randomUUID(),
        orgId: existing.id,
        email: user.email,
        role: user.role,
        passwordHash: hashPassword(`Password!${index + 1}`),
        createdAt: shiftDays(new Date(), -(30 - index * 3)),
      },
      select: { id: true, email: true, role: true },
    });
    seededUsers.push(created);
  }

  return { org: existing, users: seededUsers };
}

function cents(value: number) {
  return BigInt(Math.round(value * 100));
}

function shiftDays(base: Date, delta: number) {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + delta);
  return copy;
}

async function main() {
  const { org: acme, users: acmeUsers } = await seedOrg("acme", "Acme Holdings Pty Ltd");
  const { org: globex, users: globexUsers } = await seedOrg("globex", "Globex Innovations Ltd");

  const today = new Date();
  const start = shiftDays(today, -40);

  const acmeBankLines = Array.from({ length: 18 }).map((_, idx) => ({
    id: randomUUID(),
    orgId: acme.id,
    externalId: `ACME-${idx + 1}`,
    bankAccount: "NAB-001",
    postedAt: shiftDays(start, idx),
    valueDate: shiftDays(start, idx),
    amountCents: cents(idx % 4 === 0 ? 1250.55 : -420.25 + idx * 10),
    balanceCents: cents(150000 - idx * 250),
    counterparty: idx % 3 === 0 ? "ATO" : "Supplier" + idx,
    description: idx % 5 === 0 ? "Quarterly BAS payment" : "Operating expense",
    reference: idx % 4 === 0 ? "PAYMENT" : "DIRECT DEBIT",
    createdAt: shiftDays(start, idx),
  }));

  const globexBankLines = Array.from({ length: 7 }).map((_, idx) => ({
    id: randomUUID(),
    orgId: globex.id,
    externalId: `GLOBEX-${idx + 1}`,
    bankAccount: "CBA-445",
    postedAt: shiftDays(start, idx),
    valueDate: shiftDays(start, idx),
    amountCents: cents(idx % 2 === 0 ? 9800.25 : -199.99),
    balanceCents: cents(95000 - idx * 500),
    counterparty: idx % 2 === 0 ? "Investor" : "SaaS Vendor",
    description: idx % 2 === 0 ? "Seed capital" : "Software subscription",
    reference: "FT",
    createdAt: shiftDays(start, idx),
  }));

  const anomalyLine = {
    id: randomUUID(),
    orgId: acme.id,
    externalId: "ACME-ANOMALY",
    bankAccount: "NAB-001",
    postedAt: shiftDays(today, -5),
    valueDate: shiftDays(today, -5),
    amountCents: cents(98500.77),
    balanceCents: cents(75000),
    counterparty: "Unknown",
    description: "Unexpected outbound transfer",
    reference: "ANOMALY",
    createdAt: shiftDays(today, -5),
  };

  await prisma.bankLine.createMany({
    data: [...acmeBankLines, ...globexBankLines, anomalyLine],
    skipDuplicates: true,
  });

  const gstTxns = [
    {
      id: randomUUID(),
      orgId: acme.id,
      sourceDocument: "ACME-GST-Q1",
      periodKey: "2024-Q1",
      gstCollectedCents: cents(48250.25),
      gstPaidCents: cents(37750.1),
      netAmountCents: cents(10500.15),
      status: "reconciled",
      txnDate: shiftDays(today, -20),
    },
    {
      id: randomUUID(),
      orgId: acme.id,
      sourceDocument: "ACME-GST-Q2",
      periodKey: "2024-Q2",
      gstCollectedCents: cents(51220.4),
      gstPaidCents: cents(40100.32),
      netAmountCents: cents(11120.08),
      status: "anomaly",
      txnDate: shiftDays(today, -5),
    },
    {
      id: randomUUID(),
      orgId: globex.id,
      sourceDocument: "GLOBEX-GST-Q1",
      periodKey: "2024-Q1",
      gstCollectedCents: cents(12000.54),
      gstPaidCents: cents(9000.12),
      netAmountCents: cents(3000.42),
      status: "reconciled",
      txnDate: shiftDays(today, -18),
    },
  ];

  await prisma.gstTxn.createMany({ data: gstTxns, skipDuplicates: true });

  const paygwTxns = [
    {
      id: randomUUID(),
      orgId: acme.id,
      payrollRunId: "ACME-PAY-APR",
      periodStart: shiftDays(today, -28),
      periodEnd: shiftDays(today, -14),
      paygwWithheldCents: cents(23800.25),
      superAccruedCents: cents(16200.55),
      grossPayCents: cents(240000.0),
      submittedAt: shiftDays(today, -12),
    },
    {
      id: randomUUID(),
      orgId: acme.id,
      payrollRunId: "ACME-PAY-MAY",
      periodStart: shiftDays(today, -14),
      periodEnd: shiftDays(today, -1),
      paygwWithheldCents: cents(24890.32),
      superAccruedCents: cents(17110.11),
      grossPayCents: cents(248000.45),
      submittedAt: null,
    },
    {
      id: randomUUID(),
      orgId: globex.id,
      payrollRunId: "GLOBEX-PAY-APR",
      periodStart: shiftDays(today, -30),
      periodEnd: shiftDays(today, -15),
      paygwWithheldCents: cents(7800.12),
      superAccruedCents: cents(5300.45),
      grossPayCents: cents(75500.35),
      submittedAt: shiftDays(today, -10),
    },
  ];

  await prisma.paygwTxn.createMany({ data: paygwTxns, skipDuplicates: true });

  const basDrafts = [
    {
      id: randomUUID(),
      orgId: acme.id,
      periodKey: "2024-Q1",
      preparedByUserId: acmeUsers[1]?.id,
      reviewedByUserId: acmeUsers[0]?.id,
      gstPayableCents: cents(10500.15),
      gstReceivableCents: cents(37750.1),
      paygwWithheldCents: cents(23800.25),
      netPayableCents: cents(34300.4),
      status: "lodged",
      submittedAt: shiftDays(today, -18),
      notes: "Settled via direct debit",
    },
    {
      id: randomUUID(),
      orgId: acme.id,
      periodKey: "2024-Q2",
      preparedByUserId: acmeUsers[2]?.id,
      reviewedByUserId: acmeUsers[0]?.id,
      gstPayableCents: cents(11120.08),
      gstReceivableCents: cents(40100.32),
      paygwWithheldCents: cents(24890.32),
      netPayableCents: cents(35800.52),
      status: "draft",
      submittedAt: null,
      notes: "Pending investigation of anomaly",
    },
    {
      id: randomUUID(),
      orgId: globex.id,
      periodKey: "2024-Q1",
      preparedByUserId: globexUsers[1]?.id,
      reviewedByUserId: globexUsers[0]?.id,
      gstPayableCents: cents(3000.42),
      gstReceivableCents: cents(9000.12),
      paygwWithheldCents: cents(7800.12),
      netPayableCents: cents(7800.42),
      status: "lodged",
      submittedAt: shiftDays(today, -12),
      notes: "Paid via EFT",
    },
  ];

  await prisma.basDraft.createMany({ data: basDrafts, skipDuplicates: true });

  const auditEvents = [
    {
      id: randomUUID(),
      orgId: acme.id,
      actorUserId: acmeUsers[0]?.id ?? null,
      actorEmail: acmeUsers[0]?.email ?? null,
      action: "user.login",
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0",
      metadata: { success: true },
    },
    {
      id: randomUUID(),
      orgId: acme.id,
      actorUserId: acmeUsers[1]?.id ?? null,
      actorEmail: acmeUsers[1]?.email ?? null,
      action: "bas.submit",
      ipAddress: "203.0.113.44",
      userAgent: "Mozilla/5.0",
      metadata: { period: "2024-Q1" },
    },
    {
      id: randomUUID(),
      orgId: globex.id,
      actorUserId: globexUsers[2]?.id ?? null,
      actorEmail: globexUsers[2]?.email ?? null,
      action: "secrets.rotate",
      ipAddress: "198.51.100.9",
      userAgent: "curl/8",
      metadata: { rotation: true },
    },
  ];

  await prisma.auditEvent.createMany({ data: auditEvents, skipDuplicates: true });

  const secrets = [
    {
      id: randomUUID(),
      orgId: acme.id,
      secretKey: "primary-api-key",
      version: 1,
      cipher: "aes-256-gcm",
      iv: randomBytes(12),
      ciphertext: randomBytes(32),
      authTag: randomBytes(16),
      expiresAt: shiftDays(today, 90),
    },
    {
      id: randomUUID(),
      orgId: globex.id,
      secretKey: "primary-api-key",
      version: 2,
      cipher: "aes-256-gcm",
      iv: randomBytes(12),
      ciphertext: randomBytes(32),
      authTag: randomBytes(16),
      expiresAt: shiftDays(today, 30),
    },
  ];

  await prisma.secretBlob.createMany({ data: secrets, skipDuplicates: true });

  console.log("Database seeded with demo data");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
