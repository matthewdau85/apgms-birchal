export interface PolicyAccount {
  id: string;
  balance: number;
}

export interface PolicyTransaction {
  accountId: string;
  delta: number;
}

export interface PolicyInput {
  accounts: PolicyAccount[];
  transactions: PolicyTransaction[];
}

export interface PolicyResult {
  accounts: PolicyAccount[];
  totalBefore: number;
  totalAfter: number;
  rejected: PolicyTransaction[];
}

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const accounts = [...input.accounts].map((account) => ({ ...account }));
  accounts.sort((a, b) => a.id.localeCompare(b.id));

  const index = new Map(accounts.map((account, idx) => [account.id, idx]));
  let totalBefore = 0;
  for (const account of accounts) {
    totalBefore += account.balance;
  }

  const rejected: PolicyTransaction[] = [];

  const orderedTransactions = [...input.transactions].sort((a, b) => {
    if (a.accountId === b.accountId) {
      return a.delta - b.delta;
    }
    return a.accountId.localeCompare(b.accountId);
  });

  for (const tx of orderedTransactions) {
    const idx = index.get(tx.accountId);
    if (idx === undefined) {
      rejected.push(tx);
      continue;
    }

    const candidate = accounts[idx].balance + tx.delta;
    if (candidate < 0) {
      rejected.push(tx);
      continue;
    }

    accounts[idx].balance = candidate;
  }

  let totalAfter = 0;
  for (const account of accounts) {
    totalAfter += account.balance;
  }

  return {
    accounts,
    totalBefore,
    totalAfter,
    rejected,
  };
}
