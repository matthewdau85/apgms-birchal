/// <reference path="./global.d.ts" />
import { PrismaClient } from "@prisma/client";

let prismaSingleton: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
};

export const prisma = getPrismaClient();
