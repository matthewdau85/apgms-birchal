declare module "@prisma/client" {
  export class PrismaClient {
    user: {
      findMany(args?: any): Promise<Array<{ email: string; orgId: string; createdAt: Date }>>;
    };
    bankLine: {
      findMany(args?: any): Promise<
        Array<{ id: string; orgId: string; date: Date; amount: { toString(): string }; payee: string; desc: string; createdAt: Date }>
      >;
      create(args: { data: { orgId: string; date: Date; amount: unknown; payee: string; desc: string } }): Promise<{
        id: string;
        orgId: string;
        date: Date;
        amount: { toString(): string };
        payee: string;
        desc: string;
        createdAt: Date;
      }>;
    };
    $disconnect(): Promise<void>;
    $connect(): Promise<void>;
  }
}
