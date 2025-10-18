import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export type {
  Org,
  User,
  BankLine,
  DesignatedAccount,
  ObligationSnapshot,
  SettlementInstruction,
  DiscrepancyEvent,
  ComplianceDocument,
  Prisma,
} from "@prisma/client";
