import { createRequire } from "node:module";
import type { Prisma } from "@prisma/client";

export type DecimalLike = Prisma.Decimal | number | null | undefined;

export interface PrismaService {
  org: {
    findUnique(args: {
      where: { id: string };
      select?: { id?: boolean; name?: boolean };
    }): Promise<{ id: string; name: string } | null>;
  };
  user: {
    count(args: { where: { orgId: string } }): Promise<number>;
  };
  bankLine: {
    findMany(args: {
      where: { orgId: string };
      orderBy?: { date?: "asc" | "desc" };
    }): Promise<
      Array<{
        id: string;
        orgId: string;
        date: Date;
        amount: Prisma.Decimal | number;
        payee: string;
        desc: string;
      }>
    >;
    aggregate(args: {
      where: { orgId: string };
      _sum: { amount: true };
    }): Promise<{ _sum: { amount: Prisma.Decimal | number | null } }>;
  };
  policy: {
    findMany(args: {
      where: { orgId: string };
      orderBy?: { effectiveDate?: "asc" | "desc" };
    }): Promise<
      Array<{
        id: string;
        orgId: string;
        name: string;
        status: string;
        premium: Prisma.Decimal | number;
        effectiveDate: Date;
      }>
    >;
    count(args: { where: { orgId: string } }): Promise<number>;
  };
  auditLog: {
    findMany(args: {
      where: { orgId: string };
      orderBy?: { createdAt?: "asc" | "desc" };
      take?: number;
    }): Promise<
      Array<{
        id: string;
        orgId: string;
        actor: string;
        action: string;
        createdAt: Date;
        details?: unknown;
      }>
    >;
    findFirst(args: {
      where: { orgId: string };
      orderBy: { createdAt: "desc" };
    }): Promise<
      | {
          id: string;
          orgId: string;
          actor: string;
          action: string;
          createdAt: Date;
          details?: unknown;
        }
      | null
    >;
  };
  allocation: {
    findMany(args: {
      where: { orgId: string };
      orderBy?: { updatedAt?: "asc" | "desc" };
    }): Promise<
      Array<{
        id: string;
        orgId: string;
        portfolio: string;
        amount: Prisma.Decimal | number;
        currency: string;
        updatedAt: Date;
      }>
    >;
    aggregate(args: {
      where: { orgId: string };
      _sum: { amount: true };
    }): Promise<{ _sum: { amount: Prisma.Decimal | number | null } }>;
  };
}

const require = createRequire(import.meta.url);

let cachedPrisma: PrismaService | undefined;
let prismaError: unknown;

export const getDefaultPrisma = (): PrismaService => {
  if (cachedPrisma) {
    return cachedPrisma;
  }

  if (prismaError) {
    throw prismaError;
  }

  try {
    const { prisma } = require("../../shared/src/db") as { prisma: unknown };
    cachedPrisma = prisma as PrismaService;
    return cachedPrisma;
  } catch (error) {
    prismaError = error;
    throw error;
  }
};

export const toNumber = (value: DecimalLike): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
};
