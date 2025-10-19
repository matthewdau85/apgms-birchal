declare module "@prisma/client" {
  export type PrismaPromise<T> = Promise<T>;

  export interface UserDelegate {
    findMany<T = unknown>(args?: Record<string, unknown>): Promise<T>;
  }

  export interface BankLineDelegate {
    findMany<T = unknown>(args?: Record<string, unknown>): Promise<T>;
    create<T = unknown>(args: Record<string, unknown>): Promise<T>;
  }

  export class PrismaClient {
    user: UserDelegate;
    bankLine: BankLineDelegate;
    $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  }
}
