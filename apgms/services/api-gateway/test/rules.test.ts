import test from "node:test";
import assert from "node:assert/strict";
import { matchRule } from "../src/rules";

test("matches on regex", () => {
  const line = { amount: 25, payee: "COLES 123", desc: "groceries" };
  const rule = { payeeRegex: "^COLES" };
  assert.equal(matchRule(line, rule), true);
});

test("fails regex when not matching", () => {
  const line = { amount: 25, payee: "WOOLIES", desc: "groceries" };
  const rule = { payeeRegex: "^COLES" };
  assert.equal(matchRule(line, rule), false);
});

test("handles invalid regex by returning false", () => {
  const line = { amount: 25, payee: "COLES", desc: "groceries" };
  const rule = { payeeRegex: "[" };
  assert.equal(matchRule(line, rule), false);
});

test("matches with amount bounds", () => {
  const line = { amount: 50, payee: "ANY", desc: "" };
  const rule = { minAmount: 10, maxAmount: 100 };
  assert.equal(matchRule(line, rule), true);
});

test("rejects below minimum", () => {
  const line = { amount: 5, payee: "ANY", desc: "" };
  const rule = { minAmount: 10 };
  assert.equal(matchRule(line, rule), false);
});

test("rejects above maximum", () => {
  const line = { amount: 150, payee: "ANY", desc: "" };
  const rule = { maxAmount: 100 };
  assert.equal(matchRule(line, rule), false);
});

test("matches on description substring case insensitive", () => {
  const line = { amount: 20, payee: "ANY", desc: "Uber Eats" };
  const rule = { containsDesc: "uber" };
  assert.equal(matchRule(line, rule), true);
});

test("requires all predicates to match", () => {
  const line = { amount: 20, payee: "Uber BV", desc: "Rides" };
  const rule = { containsDesc: "ride", payeeRegex: "^Uber", minAmount: 10 };
  assert.equal(matchRule(line, rule), true);
});

test("any predicate failing rejects the rule", () => {
  const line = { amount: 20, payee: "Uber BV", desc: "Rides" };
  const rule = { containsDesc: "ride", payeeRegex: "^Lyft" };
  assert.equal(matchRule(line, rule), false);
});
