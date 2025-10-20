declare module "@prisma/client" {
  export interface PrismaPromise<T> extends Promise<T> {}

  export interface PrismaClientUserDelegate {
    findMany(args?: unknown): PrismaPromise<Array<Record<string, unknown>>>;
  }

  export interface PrismaClientBankLineDelegate {
    findMany(args?: unknown): PrismaPromise<Array<Record<string, unknown>>>;
    create(args: unknown): PrismaPromise<Record<string, unknown>>;
  }

  export class PrismaClient {
    user: PrismaClientUserDelegate;
    bankLine: PrismaClientBankLineDelegate;
  }
}
