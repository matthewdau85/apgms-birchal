import prismaModule from "@prisma/client";

const { PrismaClient } = prismaModule;

export const prisma = new PrismaClient();
