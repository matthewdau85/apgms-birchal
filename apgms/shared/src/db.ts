import { AsyncLocalStorage } from "node:async_hooks";
import PrismaPkg from "@prisma/client";

const { PrismaClient } = PrismaPkg as typeof import("@prisma/client");

type PrismaRequestContext = {
  orgId?: string;
  skipGuard?: boolean;
};

const contextStorage = new AsyncLocalStorage<PrismaRequestContext>();

const basePrisma = new PrismaClient();

const getModelDelegate = (client: PrismaClient, modelName: string) => {
  const key = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = (client as unknown as Record<string, any>)[key];
  if (!delegate) {
    throw new Error(`Prisma delegate for model ${modelName} was not found`);
  }
  return delegate;
};

basePrisma.$use(async (params, next) => {
  const store = contextStorage.getStore();

  if (!store?.orgId || store.skipGuard || !params.model) {
    return next(params);
  }

  return basePrisma.$transaction(async (tx) => {
    return contextStorage.run({ ...store, skipGuard: true }, async () => {
      await tx.$executeRaw`SET LOCAL "apgms.org_id" = ${store.orgId}`;
      const delegate = getModelDelegate(tx as unknown as PrismaClient, params.model!);
      const action = params.action as keyof typeof delegate;
      const operation = delegate[action];

      if (typeof operation !== "function") {
        throw new Error(`Unsupported Prisma action: ${String(params.action)}`);
      }

      return operation.call(delegate, params.args);
    });
  });
});

export const prisma = basePrisma;

export const withOrgContext = async <T>(orgId: string | undefined, fn: () => Promise<T> | T): Promise<T> => {
  if (!orgId) {
    return contextStorage.run({}, fn);
  }

  return contextStorage.run({ orgId }, fn);
};

export const getOrgContext = (): string | undefined => contextStorage.getStore()?.orgId;
