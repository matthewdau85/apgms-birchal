import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPolicy,
  type AccountState,
  type BankLine,
  type PolicyRuleset,
} from "@apgms/policy-engine";

test("policy engine conserves the bank line amount", () => {
  const bankLine: BankLine = {
    id: "bl-001",
    amount: 1250,
    metadata: { category: "operations" },
  };

  const accountStates: AccountState[] = [
    { accountId: "ops", balance: 300 },
    { accountId: "reserves", balance: 500 },
  ];

  const ruleset: PolicyRuleset = {
    id: "policy-main",
    version: "1.0.0",
    rules: [
      { id: "r-ops", accountId: "ops", weight: 0.6 },
      { id: "r-reserves", accountId: "reserves", weight: 0.4 },
    ],
  };

  const result = applyPolicy({ bankLine, ruleset, accountStates });

  const total = result.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  assert.strictEqual(total, bankLine.amount);
});

test("policy engine never produces negative allocations", () => {
  const bankLine: BankLine = {
    id: "bl-002",
    amount: 600,
    metadata: { category: "revenue" },
  };

  const accountStates: AccountState[] = [
    { accountId: "primary", balance: 0 },
    { accountId: "secondary", balance: 0 },
  ];

  const ruleset: PolicyRuleset = {
    id: "policy-non-negative",
    version: "1.0.0",
    rules: [
      { id: "r-primary", accountId: "primary", weight: 0.7 },
      { id: "r-secondary", accountId: "secondary", weight: 0.3 },
    ],
  };

  const result = applyPolicy({ bankLine, ruleset, accountStates });

  result.allocations.forEach((allocation) => {
    assert.ok(
      allocation.amount >= 0,
      `expected allocation for ${allocation.accountId} to be non-negative, got ${allocation.amount}`,
    );
  });
});

test("policy engine enforces gate constraints", () => {
  const bankLine: BankLine = {
    id: "bl-003",
    amount: 900,
    metadata: { category: "approved", org: { region: "au" } },
  };

  const accountStates: AccountState[] = [
    {
      accountId: "payroll",
      balance: 400,
      metadata: { region: "au" },
    },
    {
      accountId: "blocked",
      balance: 0,
      metadata: { region: "us" },
    },
  ];

  const ruleset: PolicyRuleset = {
    id: "policy-gates",
    version: "1.0.0",
    rules: [
      {
        id: "r-payroll",
        accountId: "payroll",
        weight: 1,
        gates: [
          { type: "bankLineEquals", field: "category", equals: "approved" },
          { type: "accountMetadataEquals", key: "region", equals: "au" },
        ],
      },
      {
        id: "r-blocked",
        accountId: "blocked",
        weight: 1,
        gates: [{ type: "bankLineEquals", field: "category", equals: "blocked" }],
      },
    ],
  };

  const result = applyPolicy({ bankLine, ruleset, accountStates });

  assert.strictEqual(result.allocations.length, 1);
  assert.strictEqual(result.allocations[0]?.accountId, "payroll");
  assert.strictEqual(result.allocations[0]?.amount, bankLine.amount);
});
