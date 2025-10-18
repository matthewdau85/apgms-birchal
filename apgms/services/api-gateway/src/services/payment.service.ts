import { prisma } from "@apgms/shared/src/db";

export interface PaymentInput {
  orgId: string;
  amount: number;
  date: string;
  payee: string;
  memo?: string;
}

export interface PaymentSummary {
  id: string;
  orgId: string;
  amount: number;
  date: string;
  payee: string;
  memo: string;
  createdAt: string;
}

const PAYMENT_PREFIX = "PAYMENT";

function normalizePayment(line: {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string;
  desc: string;
  createdAt: Date;
}): PaymentSummary {
  return {
    id: line.id,
    orgId: line.orgId,
    amount: typeof line.amount === "number" ? line.amount : Number(line.amount),
    date: line.date.toISOString(),
    payee: line.payee,
    memo: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
}

export const paymentService = {
  async listPaymentsByOrg(orgId: string): Promise<PaymentSummary[]> {
    const payments = await prisma.bankLine.findMany({
      where: { orgId, desc: { startsWith: PAYMENT_PREFIX } },
      orderBy: { date: "desc" },
    });

    return payments.map(normalizePayment);
  },

  async createPayment(input: PaymentInput): Promise<PaymentSummary> {
    const description = input.memo?.trim().length
      ? `${PAYMENT_PREFIX}: ${input.memo.trim()}`
      : `${PAYMENT_PREFIX}: Payment to ${input.payee}`;

    const created = await prisma.bankLine.create({
      data: {
        orgId: input.orgId,
        date: new Date(input.date),
        amount: input.amount,
        payee: input.payee,
        desc: description,
      },
    });

    return normalizePayment(created);
  },
};
