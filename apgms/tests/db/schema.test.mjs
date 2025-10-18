import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = resolve(__dirname, "../../shared/prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

function getModelBlock(modelName) {
  const lines = schema.split(/\r?\n/);
  const startPattern = new RegExp(`^model\\s+${modelName}\\s+\\{`);
  let depth = 0;
  let collecting = false;
  const buffer = [];

  for (const line of lines) {
    if (!collecting && startPattern.test(line.trim())) {
      collecting = true;
    }

    if (collecting) {
      if (line.includes("{")) depth += (line.match(/\{/g) ?? []).length;
      if (line.includes("}")) depth -= (line.match(/\}/g) ?? []).length;
      buffer.push(line);
      if (collecting && depth === 0) {
        break;
      }
    }
  }

  return buffer.join("\n");
}

test("Policy model includes required relations and index", () => {
  const block = getModelBlock("Policy");
  assert.ok(block.includes("gates       PolicyGate[]"), "Policy should expose gates relation");
  assert.ok(block.includes("tokens      ReconciliationPassToken[]"), "Policy should expose reconciliation tokens");
  assert.ok(block.includes("org         Org"), "Policy should relate to Org");
  assert.ok(block.includes("@@index([orgId])"), "Policy should be indexed by orgId");
});

test("Gate model exposes unique key and metadata", () => {
  const block = getModelBlock("Gate");
  assert.ok(block.includes("key         String       @unique"), "Gate should enforce unique key");
  assert.ok(block.includes("description String?"), "Gate should allow optional description");
});

test("PolicyGate join enforces composite uniqueness and sequence", () => {
  const block = getModelBlock("PolicyGate");
  assert.ok(block.includes("policy    Policy   @relation"), "PolicyGate should relate to Policy");
  assert.ok(block.includes("gate      Gate     @relation"), "PolicyGate should relate to Gate");
  assert.ok(block.includes("sequence  Int      @default(0)"), "PolicyGate should capture sequence");
  assert.ok(block.includes("@@unique([policyId, gateId])"), "PolicyGate should enforce composite uniqueness");
  assert.ok(block.includes("@@index([policyId])"), "PolicyGate should index policyId");
});

test("ReconciliationPassToken enforces uniqueness and relationships", () => {
  const block = getModelBlock("ReconciliationPassToken");
  assert.ok(block.includes("policy    Policy   @relation"), "Tokens should belong to a policy");
  assert.ok(block.includes("token     String   @unique"), "Tokens should be unique");
  assert.ok(block.includes("@@index([policyId])"), "Tokens should index policyId");
});

test("AuditTrail keeps optional org and user relations", () => {
  const block = getModelBlock("AuditTrail");
  assert.ok(block.includes("org        Org?"), "AuditTrail should allow optional org relation");
  assert.ok(block.includes("user       User?"), "AuditTrail should allow optional user relation");
  assert.ok(block.includes("metadata   Json?"), "AuditTrail should store metadata JSON");
  assert.ok(block.includes("@@index([entityType, entityId])"), "AuditTrail should index entity references");
});
