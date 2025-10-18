import pkg from "@prisma/client";

const { PrismaClient } = pkg as { PrismaClient: new () => any };

export const prisma = new PrismaClient();
