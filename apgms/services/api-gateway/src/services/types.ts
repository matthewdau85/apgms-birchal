import { FastifyBaseLogger } from "fastify";
import { Connectors } from "../connectors";

export interface PrismaBankLineDelegate {
  findMany(args: unknown): Promise<unknown[]>;
  create(args: unknown): Promise<unknown>;
}

export interface PrismaUserDelegate {
  findMany(args: unknown): Promise<unknown[]>;
}

export interface PrismaLike {
  bankLine: PrismaBankLineDelegate;
  user: PrismaUserDelegate;
}

export interface ServiceContext {
  prisma: PrismaLike;
  connectors: Connectors;
  logger: FastifyBaseLogger;
}
