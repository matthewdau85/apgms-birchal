import { Prisma } from "@prisma/client";

export interface OrgSeed extends Pick<Prisma.OrgUncheckedCreateInput, "id" | "name"> {}
export interface UserSeed
  extends Pick<Prisma.UserUncheckedCreateInput, "id" | "email" | "password" | "orgId"> {}
export interface BankLineSeed
  extends Pick<Prisma.BankLineUncheckedCreateInput, "id" | "orgId" | "date" | "amount" | "payee" | "desc"> {}

export const BASELINE_ORGS: OrgSeed[] = [
  { id: "org-demo", name: "Demo Holdings" },
  { id: "org-ops", name: "Operations Collective" },
];

export const BASELINE_USERS: UserSeed[] = [
  {
    id: "user-alex",
    email: "alex.demo@example.com",
    password: "password123",
    orgId: "org-demo",
  },
  {
    id: "user-sam",
    email: "sam.ops@example.com",
    password: "password123",
    orgId: "org-ops",
  },
];

export const BASELINE_BANK_LINES: BankLineSeed[] = [
  {
    id: "line-001",
    orgId: "org-demo",
    date: new Date("2024-01-03T10:00:00.000Z"),
    amount: new Prisma.Decimal("1250.50"),
    payee: "Acme Supplies",
    desc: "Office equipment",
  },
  {
    id: "line-002",
    orgId: "org-demo",
    date: new Date("2024-02-15T10:00:00.000Z"),
    amount: new Prisma.Decimal("-320.00"),
    payee: "City Power",
    desc: "Utilities",
  },
  {
    id: "line-003",
    orgId: "org-ops",
    date: new Date("2024-03-20T10:00:00.000Z"),
    amount: new Prisma.Decimal("8450.00"),
    payee: "Global Partners",
    desc: "Consulting retainer",
  },
];

export const BASELINE_DATA = {
  orgs: BASELINE_ORGS,
  users: BASELINE_USERS,
  bankLines: BASELINE_BANK_LINES,
};
