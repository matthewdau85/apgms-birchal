import { Prisma } from "@prisma/client";

type StubTransaction = {
  orgId: string;
  externalId: string;
  date: Date;
  amount: Prisma.Decimal;
  payee: string;
  desc: string;
};

/**
 * Pretend to fetch new transactions from an external bank feed.
 * Returns a deterministic set per org so that upsert behaviour can be observed
 * across multiple runs.
 */
export async function fetchStubBankTransactions(orgId: string): Promise<StubTransaction[]> {
  const baseDate = new Date();
  const amounts = ["125.40", "-50.00", "230.10"];
  const payees = ["Coffee Supplier", "Office Rent", "Client Refund"];
  const desc = ["Monthly beans", "HQ lease", "Refund issued"];

  return amounts.map((amount, index) => ({
    orgId,
    externalId: `${orgId}-stub-${index + 1}`,
    date: new Date(baseDate.getTime() - index * 86_400_000),
    amount: new Prisma.Decimal(amount),
    payee: payees[index],
    desc: desc[index],
  }));
}

export type BankFeedResult = {
  processed: number;
};
