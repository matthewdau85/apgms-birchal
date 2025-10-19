import prismaPackage from "@prisma/client";

type PrismaModule = typeof import("@prisma/client");

const { PrismaClient } = prismaPackage as PrismaModule;

export const prisma = new PrismaClient();
