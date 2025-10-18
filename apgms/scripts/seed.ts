import { PrismaClient } from "@prisma/client";
import { generateSeedData } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {
      name: "Demo Org",
    },
    create: { id: "demo-org", name: "Demo Org" },
  });

  await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: {
      orgId: org.id,
    },
    create: { email: "founder@example.com", password: "password123", orgId: org.id },
  });

  const seed = generateSeedData(org.id);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE "orgId" = $1`, org.id);
    await tx.$executeRawUnsafe(
      `DELETE FROM "PolicyGate" USING "Policy" WHERE "PolicyGate"."policyId" = "Policy"."id" AND "Policy"."orgId" = $1`,
      org.id,
    );
    await tx.$executeRawUnsafe(`DELETE FROM "Policy" WHERE "orgId" = $1`, org.id);
    await tx.$executeRawUnsafe(
      `DELETE FROM "Allocation" USING "BankLine" WHERE "Allocation"."bankLineId" = "BankLine"."id" AND "BankLine"."orgId" = $1`,
      org.id,
    );
    await tx.bankLine.deleteMany({ where: { orgId: org.id } });

    if (seed.bankLines.length > 0) {
      await tx.bankLine.createMany({ data: seed.bankLines });
    }

    for (const allocation of seed.allocations) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "Allocation" ("id", "bankLineId", "category", "amount", "notes", "createdAt") VALUES ($1, $2, $3, $4, $5, $6)`,
        allocation.id,
        allocation.bankLineId,
        allocation.category,
        allocation.amount,
        allocation.notes ?? null,
        allocation.createdAt,
      );
    }

    for (const policy of seed.policies) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "Policy" ("id", "orgId", "name", "description", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5::"PolicyStatus", $6, $7)`,
        policy.id,
        policy.orgId,
        policy.name,
        policy.description,
        policy.status,
        policy.createdAt,
        policy.updatedAt,
      );
    }

    for (const gate of seed.gates) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "PolicyGate" ("id", "policyId", "name", "type", "config", "createdAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        gate.id,
        gate.policyId,
        gate.name,
        gate.type,
        JSON.stringify(gate.config),
        gate.createdAt,
      );
    }

    for (const event of seed.auditEvents) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "AuditEvent" ("id", "orgId", "actor", "actorType", "action", "entityType", "entityId", "metadata", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        event.id,
        event.orgId,
        event.actor,
        event.actorType,
        event.action,
        event.entityType,
        event.entityId,
        JSON.stringify(event.metadata),
        event.createdAt,
      );
    }
  });

  console.log(
    `Seeded ${seed.policies.length} policies, ${seed.gates.length} gates, ${seed.bankLines.length} bank lines, ${seed.allocations.length} allocations, and ${seed.auditEvents.length} audit events for ${org.name}.`,
  );
}

main()
  .catch((error) => {
    console.error("Failed seeding database", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
